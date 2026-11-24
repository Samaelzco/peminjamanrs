-- =====================================================================
-- Prefix kode aset boleh dipakai bersama beberapa kategori (mis. Webcam & Conf-Cam = TI-CAM)
-- dan boleh mengandung tanda hubung (mis. TI-LPT → TI-LPT-001).
-- =====================================================================

-- 1. Prefix tidak lagi unik.
alter table public.kategori drop constraint if exists kategori_kode_prefix_key;

-- 2. Format prefix: segmen huruf kapital 2–5 karakter, dipisah tanda hubung (maks 3 segmen).
alter table public.kategori drop constraint if exists kategori_kode_prefix_check;
alter table public.kategori
  add constraint kategori_kode_prefix_check
  check (kode_prefix ~ '^[A-Z]{2,5}(-[A-Z]{2,5}){0,2}$');
create index if not exists kategori_kode_prefix_idx on public.kategori (kode_prefix);

-- 3. Kode aset otomatis: nomor berikutnya = nomor terbesar di antara SEMUA aset berawalan
--    prefix itu, apa pun kategorinya. Diserialkan per prefix dengan advisory lock karena
--    kategori berbeda bisa berbagi prefix (lock baris kategori saja tidak cukup).
create or replace function public.aset_generate_kode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_pola   text;
  v_next   int;
begin
  select kode_prefix into v_prefix from public.kategori where id = new.kategori_id;
  if v_prefix is null then
    raise exception 'Kategori tidak ditemukan.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.aset.kode:' || v_prefix));
  -- Prefix hanya berisi A-Z dan "-", aman dipakai langsung di pola regex.
  v_pola := '^' || v_prefix || '-[0-9]{3,}$';

  if new.kode_aset is null or new.kode_aset = '' then
    select coalesce(max(substring(kode_aset from length(v_prefix) + 2)::int), 0) + 1
      into v_next
      from public.aset
     where kode_aset ~ v_pola;
    new.kode_aset := v_prefix || '-' || lpad(v_next::text, greatest(3, length(v_next::text)), '0');
  elsif new.kode_aset !~ v_pola then
    raise exception 'Kode aset % tidak sesuai prefix kategori %.', new.kode_aset, v_prefix
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function public.aset_generate_kode() from public, anon, authenticated;

-- 4. Reset data demo (/debug) memakai data demo terbaru.
create or replace function public.reset_data_demo()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_peminjaman int;
  v_aset_dihapus int;
  v_kategori_dihapus int;
begin
  select count(*) into v_peminjaman from public.peminjaman;

  truncate table
    public.foto_pemasangan,
    public.foto_pengembalian,
    public.pemasangan,
    public.pengembalian,
    public.penggantian_unit,
    public.log_peminjaman,
    public.notifikasi,
    public.detail_peminjaman,
    public.peminjaman
  restart identity;

  -- Kategori demo: upsert berdasarkan nama.
  insert into public.kategori (nama, kode_prefix) values
    ('Laptop', 'TI-LPT'), ('Proyektor', 'TI-PRJ'), ('Webcam', 'TI-CAM'), ('Conf-Cam', 'TI-CAM')
  on conflict (nama) do nothing;

  -- Hapus aset & kategori di luar data demo (aset dulu karena FK).
  delete from public.aset
  where kode_aset not in ('TI-LPT-001','TI-LPT-002','TI-LPT-003','TI-LPT-004',
                          'TI-PRJ-001','TI-PRJ-002','TI-CAM-001','TI-CAM-002');
  get diagnostics v_aset_dihapus = row_count;

  delete from public.kategori where nama not in ('Laptop', 'Proyektor', 'Webcam', 'Conf-Cam');
  get diagnostics v_kategori_dihapus = row_count;

  -- Pastikan prefix kategori demo benar (aman: aset lama sudah dihapus).
  update public.kategori k set kode_prefix = d.prefix
  from (values ('Laptop','TI-LPT'), ('Proyektor','TI-PRJ'), ('Webcam','TI-CAM'), ('Conf-Cam','TI-CAM')) as d(nama, prefix)
  where k.nama = d.nama and k.kode_prefix <> d.prefix;

  perform set_config('app.alur_peminjaman', 'on', true);

  insert into public.aset (kode_aset, nama_aset, kategori_id, deskripsi, kondisi, status)
  select d.kode, d.nama, k.id, d.deskripsi, 'baik', 'tersedia'
  from (values
    ('TI-LPT-001', 'Lenovo ThinkPad L14 Gen 3', 'Laptop',    'i5 12th, 16GB, 512GB, Win11, charger 65W, tas'),
    ('TI-LPT-002', 'Dell Latitude 3420',        'Laptop',    'i5 11th, 8GB, 256GB, Win11, adaptor 65W, tas, mouse'),
    ('TI-LPT-003', 'ASUS ExpertBook B1400',     'Laptop',    'i3 11th, 8GB, 256GB, Win10, charger 65W, tas'),
    ('TI-LPT-004', 'HP ProBook 440 G8',         'Laptop',    'i5 11th, 16GB, 512GB, charger 65W'),
    ('TI-PRJ-001', 'Epson EB-X500',             'Proyektor', '3600 lumens, XGA, HDMI/VGA, kabel power, HDMI 5m, remote, tas'),
    ('TI-PRJ-002', 'BenQ MX560',                'Proyektor', '4000 lumens, XGA, dual HDMI, kabel power, HDMI 10m, tas'),
    ('TI-CAM-001', 'Logitech C922 Pro',         'Webcam',    '1080p 30fps, dual stereo mic, tripod mini, pouch'),
    ('TI-CAM-002', 'Logitech MeetUp Conf',      'Conf-Cam',  '4K 120° FOV, 3-mic, speakerphone, remote, USB 5m, adaptor')
  ) as d(kode, nama, kategori, deskripsi)
  join public.kategori k on k.nama = d.kategori
  on conflict (kode_aset) do update
    set nama_aset = excluded.nama_aset,
        deskripsi = excluded.deskripsi,
        kondisi = 'baik',
        status = 'tersedia';

  perform set_config('app.alur_peminjaman', '', true);

  return jsonb_build_object(
    'peminjaman_dihapus', v_peminjaman,
    'aset_lain_dihapus', v_aset_dihapus,
    'kategori_lain_dihapus', v_kategori_dihapus
  );
end;
$$;

revoke execute on function public.reset_data_demo() from public, anon, authenticated;
grant execute on function public.reset_data_demo() to service_role;
