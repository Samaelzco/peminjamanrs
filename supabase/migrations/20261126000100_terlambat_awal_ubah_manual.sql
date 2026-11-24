-- =====================================================================
-- 1) Peminjaman baru yang rencana kembalinya sudah lewat langsung berstatus Terlambat.
--    Peminjaman seperti ini belum dipasang, jadi alur pemasangan/pembatalan juga
--    berlaku untuk status Terlambat selama unit belum dipasang.
-- 2) Koreksi riwayat oleh Administrasi: ubah data peminjam, jadwal, dan status
--    (permission peminjaman.update, RPC ubah_peminjaman).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Permission baru
-- ---------------------------------------------------------------------
insert into public.permissions (nama, modul, deskripsi) values
  ('peminjaman.update', 'Peminjaman', 'Mengubah data & status peminjaman (koreksi riwayat)')
on conflict (nama) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.nama = 'Administrasi' and p.nama = 'peminjaman.update'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Helper: unit peminjaman sudah dipasang? (ada pemasangan, atau hasil perpanjangan)
-- ---------------------------------------------------------------------
create or replace function public.sudah_terpasang(p_peminjaman_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.pemasangan where peminjaman_id = p_peminjaman_id)
      or exists (select 1 from public.peminjaman where id = p_peminjaman_id and perpanjangan_dari is not null);
$$;
revoke execute on function public.sudah_terpasang(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Transisi status
-- ---------------------------------------------------------------------
create or replace function public.guard_status_peminjaman()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'diajukan'
       or (new.status = 'dipinjam' and new.perpanjangan_dari is not null)
       or (new.status = 'terlambat' and new.perpanjangan_dari is null and new.tgl_rencana_kembali <= now()) then
      return new;
    end if;
    raise exception 'Peminjaman baru tidak boleh berstatus "%".', new.status using errcode = 'P0001';
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Koreksi manual (ubah_peminjaman) memvalidasi aturannya sendiri.
  if coalesce(current_setting('app.ubah_manual', true), '') = 'on' then
    return new;
  end if;

  if (old.status, new.status) in (
       ('diajukan'::public.status_peminjaman,  'dipinjam'::public.status_peminjaman),
       ('diajukan',  'dibatalkan'),
       ('dipinjam',  'terlambat'),
       ('dipinjam',  'selesai'),
       ('terlambat', 'selesai'),
       ('terlambat', 'dibatalkan')) then
    return new;
  end if;

  -- Pemasangan untuk peminjaman yang sudah terlambat sejak dicatat.
  if old.status = 'terlambat' and new.status = 'dipinjam'
     and coalesce(current_setting('app.alur_peminjaman', true), '') = 'on' then
    return new;
  end if;

  raise exception 'Transisi status peminjaman dari "%" ke "%" tidak diizinkan.', old.status, new.status
    using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------
-- Membuat peminjaman: status Terlambat bila rencana kembali sudah lewat
-- ---------------------------------------------------------------------
create or replace function public.buat_peminjaman(
  p_nama_peminjam text,
  p_divisi_peminjam text,
  p_kontak_peminjam text,
  p_ruangan text,
  p_keperluan text,
  p_tgl_peminjaman timestamptz,
  p_tgl_rencana_kembali timestamptz,
  p_aset_ids bigint[]
)
returns table (id bigint, kode_peminjaman text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_ids        bigint[];
  v_bentrok    text;
  v_hilang     int;
  v_terlambat  boolean := p_tgl_rencana_kembali <= now();
  v_peminjaman public.peminjaman;
begin
  perform public.wajib_permission('peminjaman.create');

  select array_agg(distinct x) into v_ids from unnest(p_aset_ids) x where x is not null;
  if v_ids is null or cardinality(v_ids) = 0 then
    raise exception 'Pilih minimal satu unit.' using errcode = 'P0001';
  end if;
  if p_tgl_rencana_kembali <= p_tgl_peminjaman then
    raise exception 'Tanggal rencana kembali harus setelah tanggal peminjaman.' using errcode = 'P0001';
  end if;

  -- Kunci baris aset (urut id untuk menghindari deadlock).
  perform 1 from public.aset where public.aset.id = any (v_ids) order by public.aset.id for update;

  select cardinality(v_ids) - count(*) into v_hilang from public.aset where public.aset.id = any (v_ids);
  if v_hilang > 0 then
    raise exception 'Sebagian unit tidak ditemukan. Muat ulang halaman.' using errcode = 'P0001';
  end if;

  -- Cek ulang ketersediaan setelah terkunci.
  select string_agg(a.kode_aset, ', ' order by a.kode_aset) into v_bentrok
  from public.aset a
  where a.id = any (v_ids)
    and (a.status <> 'tersedia' or public.aset_terikat(a.id));
  if v_bentrok is not null then
    raise exception 'Unit % sudah tidak tersedia (dipakai peminjaman lain). Ganti unit tersebut lalu simpan ulang.', v_bentrok
      using errcode = 'P0001';
  end if;

  if v_terlambat then
    perform set_config('app.keterangan_log', 'Rencana kembali sudah lewat saat dicatat, langsung ditandai terlambat.', true);
  end if;

  insert into public.peminjaman (
    dicatat_oleh, nama_peminjam, divisi_peminjam, kontak_peminjam, ruangan, keperluan,
    tgl_peminjaman, tgl_rencana_kembali, status
  ) values (
    (select auth.uid()), trim(p_nama_peminjam), trim(p_divisi_peminjam), trim(p_kontak_peminjam),
    trim(p_ruangan), trim(p_keperluan), p_tgl_peminjaman, p_tgl_rencana_kembali,
    case when v_terlambat then 'terlambat'::public.status_peminjaman else 'diajukan'::public.status_peminjaman end
  )
  returning * into v_peminjaman;

  perform set_config('app.keterangan_log', '', true);

  insert into public.detail_peminjaman (peminjaman_id, aset_id)
  select v_peminjaman.id, x from unnest(v_ids) x;

  perform public.kirim_notifikasi(
    'pemasangan.create',
    v_peminjaman.id,
    format('Peminjaman %s (%s, %s) menunggu pemasangan.%s',
           v_peminjaman.kode_peminjaman, v_peminjaman.nama_peminjam, v_peminjaman.ruangan,
           case when v_terlambat then ' Rencana kembali sudah lewat (terlambat).' else '' end)
  );

  if v_terlambat then
    perform public.kirim_notifikasi(
      'peminjaman.view',
      v_peminjaman.id,
      format('Peminjaman %s (%s, %s) terlambat. Rencana kembali %s WITA.',
             v_peminjaman.kode_peminjaman, v_peminjaman.nama_peminjam, v_peminjaman.ruangan,
             to_char(v_peminjaman.tgl_rencana_kembali at time zone 'Asia/Makassar', 'DD/MM/YYYY HH24:MI')),
      'terlambat'
    );
  end if;

  return query select v_peminjaman.id, v_peminjaman.kode_peminjaman;
end;
$$;

-- ---------------------------------------------------------------------
-- Pembatalan: diajukan, atau terlambat yang belum dipasang
-- ---------------------------------------------------------------------
create or replace function public.batalkan_peminjaman(p_peminjaman_id bigint, p_alasan text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status public.status_peminjaman;
begin
  perform public.wajib_permission('peminjaman.cancel');

  select status into v_status from public.peminjaman where id = p_peminjaman_id for update;
  if v_status is null then
    raise exception 'Peminjaman tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not (v_status = 'diajukan' or (v_status = 'terlambat' and not public.sudah_terpasang(p_peminjaman_id))) then
    raise exception 'Hanya peminjaman yang belum dipasang yang dapat dibatalkan.' using errcode = 'P0001';
  end if;

  perform set_config('app.keterangan_log', coalesce(nullif(trim(p_alasan), ''), 'Dibatalkan'), true);
  update public.peminjaman set status = 'dibatalkan' where id = p_peminjaman_id;
  perform set_config('app.keterangan_log', '', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Reservasi ID foto
-- ---------------------------------------------------------------------
create or replace function public.reservasi_id_kejadian(p_jenis text, p_peminjaman_id bigint)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status    public.status_peminjaman;
  v_terpasang boolean;
begin
  select status into v_status from public.peminjaman where id = p_peminjaman_id;
  if v_status is null then
    raise exception 'Peminjaman tidak ditemukan.' using errcode = 'P0001';
  end if;
  v_terpasang := public.sudah_terpasang(p_peminjaman_id);

  if p_jenis = 'pemasangan' then
    perform public.wajib_permission('pemasangan.create');
    if not (v_status in ('diajukan', 'terlambat') and not v_terpasang) then
      raise exception 'Pemasangan hanya untuk peminjaman yang belum dipasang.' using errcode = 'P0001';
    end if;
    return nextval(pg_get_serial_sequence('public.pemasangan', 'id'));
  elsif p_jenis = 'pengembalian' then
    perform public.wajib_permission('pengembalian.create');
    if v_status not in ('dipinjam', 'terlambat') or not v_terpasang then
      raise exception 'Pengembalian hanya untuk peminjaman yang sudah dipasang dan berstatus dipinjam atau terlambat.' using errcode = 'P0001';
    end if;
    return nextval(pg_get_serial_sequence('public.pengembalian', 'id'));
  end if;

  raise exception 'Jenis tidak dikenal.' using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------
-- Ganti unit saat pemasangan
-- ---------------------------------------------------------------------
create or replace function public.ganti_unit_pemasangan(p_detail_id bigint, p_aset_baru_id bigint, p_alasan text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_detail   public.detail_peminjaman;
  v_status   public.status_peminjaman;
  v_lama     public.aset;
  v_baru     public.aset;
begin
  perform public.wajib_permission('pemasangan.create');

  if p_alasan is null or length(trim(p_alasan)) = 0 then
    raise exception 'Alasan penggantian wajib diisi.' using errcode = 'P0001';
  end if;

  select * into v_detail from public.detail_peminjaman where id = p_detail_id;
  if v_detail.id is null then
    raise exception 'Unit peminjaman tidak ditemukan.' using errcode = 'P0001';
  end if;

  select status into v_status from public.peminjaman where id = v_detail.peminjaman_id for update;
  if not (v_status in ('diajukan', 'terlambat') and not public.sudah_terpasang(v_detail.peminjaman_id)) then
    raise exception 'Unit hanya dapat diganti sebelum pemasangan disimpan.' using errcode = 'P0001';
  end if;

  perform 1 from public.aset where id in (v_detail.aset_id, p_aset_baru_id) order by id for update;
  select * into v_lama from public.aset where id = v_detail.aset_id;
  select * into v_baru from public.aset where id = p_aset_baru_id;

  if v_baru.id is null then
    raise exception 'Unit pengganti tidak ditemukan.' using errcode = 'P0001';
  end if;
  if v_baru.id = v_lama.id then
    raise exception 'Unit pengganti harus berbeda.' using errcode = 'P0001';
  end if;
  if v_baru.kategori_id <> v_lama.kategori_id then
    raise exception 'Unit pengganti harus dari kategori yang sama.' using errcode = 'P0001';
  end if;
  if v_baru.status <> 'tersedia' or public.aset_terikat(v_baru.id) then
    raise exception 'Unit % sudah tidak tersedia. Pilih unit lain.', v_baru.kode_aset using errcode = 'P0001';
  end if;

  update public.detail_peminjaman set aset_id = v_baru.id, kondisi_keluar = null where id = v_detail.id;
  update public.aset set status = 'dalam_perbaikan' where id = v_lama.id and status = 'tersedia';

  insert into public.penggantian_unit (detail_peminjaman_id, aset_lama_id, aset_baru_id, alasan, staff_id)
  values (v_detail.id, v_lama.id, v_baru.id, trim(p_alasan), (select auth.uid()));
end;
$$;

-- ---------------------------------------------------------------------
-- Simpan pemasangan (diajukan, atau terlambat yang belum dipasang)
-- ---------------------------------------------------------------------
create or replace function public.simpan_pemasangan(
  p_peminjaman_id bigint,
  p_pemasangan_id bigint,
  p_units jsonb,
  p_foto text[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_p         public.peminjaman;
  v_foto      text[];
  v_jumlah    int;
  v_cocok     int;
  v_bentrok   text;
begin
  perform public.wajib_permission('pemasangan.create');

  select * into v_p from public.peminjaman where id = p_peminjaman_id for update;
  if v_p.id is null then
    raise exception 'Peminjaman tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not (v_p.status in ('diajukan', 'terlambat') and not public.sudah_terpasang(v_p.id)) then
    raise exception 'Pemasangan hanya untuk peminjaman yang belum dipasang (status sekarang: %).', v_p.status
      using errcode = 'P0001';
  end if;

  select count(*) into v_jumlah from public.detail_peminjaman where peminjaman_id = v_p.id;
  select count(*) into v_cocok
  from jsonb_to_recordset(coalesce(p_units, '[]'::jsonb)) as u(detail_id bigint, kondisi_keluar text)
  join public.detail_peminjaman d on d.id = u.detail_id and d.peminjaman_id = v_p.id
  where u.kondisi_keluar in ('baik', 'rusak');
  if v_cocok <> v_jumlah or jsonb_array_length(coalesce(p_units, '[]'::jsonb)) <> v_jumlah then
    raise exception 'Isi kondisi keluar (baik/rusak) untuk semua unit.' using errcode = 'P0001';
  end if;

  v_foto := public.validasi_foto(p_foto, 'pemasangan/' || p_pemasangan_id || '/');

  perform 1 from public.aset a
  where a.id in (select aset_id from public.detail_peminjaman where peminjaman_id = v_p.id)
  order by a.id for update;

  select string_agg(a.kode_aset || ' (' || a.status || ')', ', ' order by a.kode_aset) into v_bentrok
  from public.detail_peminjaman d
  join public.aset a on a.id = d.aset_id
  where d.peminjaman_id = v_p.id and a.status <> 'tersedia';
  if v_bentrok is not null then
    raise exception 'Unit % tidak berstatus tersedia. Ganti unit tersebut terlebih dahulu.', v_bentrok
      using errcode = 'P0001';
  end if;

  perform set_config('app.alur_peminjaman', 'on', true);

  insert into public.pemasangan (id, peminjaman_id, staff_id, tgl_pemasangan)
  values (p_pemasangan_id, v_p.id, (select auth.uid()), now());

  insert into public.foto_pemasangan (pemasangan_id, path_foto)
  select p_pemasangan_id, x from unnest(v_foto) x;

  update public.detail_peminjaman d
     set kondisi_keluar = u.kondisi_keluar::public.kondisi_aset
    from jsonb_to_recordset(p_units) as u(detail_id bigint, kondisi_keluar text)
   where d.id = u.detail_id and d.peminjaman_id = v_p.id;

  update public.aset a
     set status = 'dipinjam',
         kondisi = d.kondisi_keluar
    from public.detail_peminjaman d
   where d.peminjaman_id = v_p.id and a.id = d.aset_id;

  perform set_config('app.keterangan_log',
    format('Pemasangan %s unit dengan %s foto.', v_jumlah, cardinality(v_foto)), true);
  update public.peminjaman set status = 'dipinjam' where id = v_p.id;

  -- Rencana kembali sudah lewat: langsung kembali ke Terlambat.
  if v_p.tgl_rencana_kembali <= now() then
    perform set_config('app.keterangan_log', 'Rencana kembali sudah lewat.', true);
    update public.peminjaman set status = 'terlambat' where id = v_p.id;
  end if;

  perform set_config('app.keterangan_log', '', true);
  perform set_config('app.alur_peminjaman', '', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Pengembalian & perpanjangan: wajib sudah dipasang
-- ---------------------------------------------------------------------
create or replace function public.simpan_pengembalian(
  p_peminjaman_id bigint,
  p_pengembalian_id bigint,
  p_units jsonb,
  p_foto text[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_p          public.peminjaman;
  v_foto       text[];
  v_jumlah     int;
  v_cocok      int;
  v_masalah    text;
begin
  perform public.wajib_permission('pengembalian.create');

  select * into v_p from public.peminjaman where id = p_peminjaman_id for update;
  if v_p.id is null then
    raise exception 'Peminjaman tidak ditemukan.' using errcode = 'P0001';
  end if;
  if v_p.status not in ('dipinjam', 'terlambat') then
    raise exception 'Pengembalian hanya untuk peminjaman berstatus dipinjam atau terlambat (status sekarang: %).', v_p.status
      using errcode = 'P0001';
  end if;
  if not public.sudah_terpasang(v_p.id) then
    raise exception 'Unit belum dipasang. Catat pemasangan terlebih dahulu.' using errcode = 'P0001';
  end if;

  select count(*) into v_jumlah from public.detail_peminjaman where peminjaman_id = v_p.id;
  select count(*) into v_cocok
  from jsonb_to_recordset(coalesce(p_units, '[]'::jsonb)) as u(detail_id bigint, kondisi_masuk text, catatan text)
  join public.detail_peminjaman d on d.id = u.detail_id and d.peminjaman_id = v_p.id
  where u.kondisi_masuk in ('baik', 'rusak', 'hilang');
  if v_cocok <> v_jumlah or jsonb_array_length(coalesce(p_units, '[]'::jsonb)) <> v_jumlah then
    raise exception 'Semua unit harus dikembalikan sekaligus. Isi kondisi masuk untuk setiap unit.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_units) as u(detail_id bigint, kondisi_masuk text, catatan text)
    where u.kondisi_masuk in ('rusak', 'hilang') and length(trim(coalesce(u.catatan, ''))) = 0
  ) then
    raise exception 'Catatan wajib diisi untuk unit yang rusak atau hilang.' using errcode = 'P0001';
  end if;

  v_foto := public.validasi_foto(p_foto, 'pengembalian/' || p_pengembalian_id || '/');

  perform 1 from public.aset a
  where a.id in (select aset_id from public.detail_peminjaman where peminjaman_id = v_p.id)
  order by a.id for update;

  perform set_config('app.alur_peminjaman', 'on', true);

  insert into public.pengembalian (id, peminjaman_id, staff_id, tgl_kembali)
  values (p_pengembalian_id, v_p.id, (select auth.uid()), now());

  insert into public.foto_pengembalian (pengembalian_id, path_foto)
  select p_pengembalian_id, x from unnest(v_foto) x;

  update public.detail_peminjaman d
     set kondisi_masuk = u.kondisi_masuk::public.kondisi_masuk,
         catatan = nullif(trim(coalesce(u.catatan, '')), '')
    from jsonb_to_recordset(p_units) as u(detail_id bigint, kondisi_masuk text, catatan text)
   where d.id = u.detail_id and d.peminjaman_id = v_p.id;

  update public.aset a
     set status = case d.kondisi_masuk
                    when 'baik' then 'tersedia'::public.status_aset
                    when 'rusak' then 'dalam_perbaikan'::public.status_aset
                    else 'hilang'::public.status_aset
                  end,
         kondisi = case d.kondisi_masuk
                     when 'baik' then 'baik'::public.kondisi_aset
                     when 'rusak' then 'rusak'::public.kondisi_aset
                     else a.kondisi
                   end
    from public.detail_peminjaman d
   where d.peminjaman_id = v_p.id and a.id = d.aset_id;

  select string_agg(a.kode_aset || ' ' || d.kondisi_masuk, ', ' order by a.kode_aset) into v_masalah
  from public.detail_peminjaman d
  join public.aset a on a.id = d.aset_id
  where d.peminjaman_id = v_p.id and d.kondisi_masuk in ('rusak', 'hilang');

  perform set_config('app.keterangan_log',
    format('Pengembalian %s unit dengan %s foto.%s', v_jumlah, cardinality(v_foto),
           case when v_masalah is not null then ' Bermasalah: ' || v_masalah || '.' else '' end), true);
  update public.peminjaman set status = 'selesai' where id = v_p.id;

  if v_masalah is not null then
    perform public.kirim_notifikasi(
      'peminjaman.view',
      v_p.id,
      format('Pengembalian %s: %s.', v_p.kode_peminjaman, v_masalah)
    );
  end if;

  perform set_config('app.keterangan_log', '', true);
  perform set_config('app.alur_peminjaman', '', true);
end;
$$;

create or replace function public.perpanjang_peminjaman(
  p_peminjaman_id bigint,
  p_tgl_rencana_kembali timestamptz,
  p_alasan text
)
returns table (id bigint, kode_peminjaman text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_lama  public.peminjaman;
  v_baru  public.peminjaman;
  v_now   timestamptz := now();
begin
  perform public.wajib_permission('peminjaman.extend');

  if p_alasan is null or length(trim(p_alasan)) = 0 then
    raise exception 'Alasan perpanjangan wajib diisi.' using errcode = 'P0001';
  end if;

  select * into v_lama from public.peminjaman where public.peminjaman.id = p_peminjaman_id for update;
  if v_lama.id is null then
    raise exception 'Peminjaman tidak ditemukan.' using errcode = 'P0001';
  end if;
  if v_lama.status not in ('dipinjam', 'terlambat') then
    raise exception 'Perpanjangan hanya untuk peminjaman berstatus dipinjam atau terlambat.' using errcode = 'P0001';
  end if;
  if not public.sudah_terpasang(v_lama.id) then
    raise exception 'Unit belum dipasang. Catat pemasangan terlebih dahulu.' using errcode = 'P0001';
  end if;
  if p_tgl_rencana_kembali is null or p_tgl_rencana_kembali <= v_now then
    raise exception 'Tanggal rencana kembali baru harus setelah waktu sekarang.' using errcode = 'P0001';
  end if;

  perform set_config('app.keterangan_log',
    format('Perpanjangan dari %s. Alasan: %s', v_lama.kode_peminjaman, trim(p_alasan)), true);

  insert into public.peminjaman (
    dicatat_oleh, perpanjangan_dari, nama_peminjam, divisi_peminjam, kontak_peminjam, ruangan,
    keperluan, tgl_peminjaman, tgl_rencana_kembali, status
  ) values (
    (select auth.uid()), v_lama.id, v_lama.nama_peminjam, v_lama.divisi_peminjam, v_lama.kontak_peminjam,
    v_lama.ruangan, v_lama.keperluan || E'\n— Perpanjangan: ' || trim(p_alasan),
    v_now, p_tgl_rencana_kembali, 'dipinjam'
  )
  returning * into v_baru;

  insert into public.detail_peminjaman (peminjaman_id, aset_id, kondisi_keluar)
  select v_baru.id, d.aset_id, d.kondisi_keluar
  from public.detail_peminjaman d
  where d.peminjaman_id = v_lama.id;

  perform set_config('app.keterangan_log',
    format('Ditutup karena diperpanjang menjadi %s (tanpa pengembalian).', v_baru.kode_peminjaman), true);
  update public.peminjaman set status = 'selesai' where public.peminjaman.id = v_lama.id;
  perform set_config('app.keterangan_log', '', true);

  return query select v_baru.id, v_baru.kode_peminjaman;
end;
$$;

-- ---------------------------------------------------------------------
-- Koreksi manual (Administrasi)
--   Status yang boleh dipilih:
--   - belum dipasang : diajukan, terlambat, dibatalkan
--   - sudah dipasang : dipinjam, terlambat, selesai
--   - sudah dikembalikan / sudah diperpanjang: status dikunci (data tetap bisa diperbaiki)
--   Terlambat hanya bila rencana kembali sudah lewat; diajukan/dipinjam hanya bila belum.
-- ---------------------------------------------------------------------
create or replace function public.ubah_peminjaman(
  p_peminjaman_id bigint,
  p_nama_peminjam text,
  p_divisi_peminjam text,
  p_kontak_peminjam text,
  p_ruangan text,
  p_keperluan text,
  p_tgl_peminjaman timestamptz,
  p_tgl_rencana_kembali timestamptz,
  p_status public.status_peminjaman,
  p_keterangan text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_p            public.peminjaman;
  v_terpasang    boolean;
  v_dikembalikan boolean;
  v_diperpanjang boolean;
  v_aktif_lama   boolean;
  v_aktif_baru   boolean;
  v_bentrok      text;
  v_berubah      text[] := '{}';
  v_ket          text := nullif(trim(coalesce(p_keterangan, '')), '');
begin
  perform public.wajib_permission('peminjaman.update');

  select * into v_p from public.peminjaman where id = p_peminjaman_id for update;
  if v_p.id is null then
    raise exception 'Peminjaman tidak ditemukan.' using errcode = 'P0001';
  end if;
  if p_status is null then
    raise exception 'Status wajib dipilih.' using errcode = 'P0001';
  end if;
  if p_tgl_rencana_kembali <= p_tgl_peminjaman then
    raise exception 'Tanggal rencana kembali harus setelah tanggal keluar.' using errcode = 'P0001';
  end if;

  v_terpasang    := public.sudah_terpasang(v_p.id);
  v_dikembalikan := exists (select 1 from public.pengembalian where peminjaman_id = v_p.id);
  v_diperpanjang := exists (select 1 from public.peminjaman where perpanjangan_dari = v_p.id);

  if p_status <> v_p.status then
    if v_dikembalikan then
      raise exception 'Status tidak dapat diubah karena pengembalian sudah dicatat.' using errcode = 'P0001';
    end if;
    if v_diperpanjang then
      raise exception 'Status tidak dapat diubah karena peminjaman ini sudah diperpanjang.' using errcode = 'P0001';
    end if;
    if v_terpasang and p_status not in ('dipinjam', 'terlambat', 'selesai') then
      raise exception 'Unit sudah dipasang: status hanya bisa Dipinjam, Terlambat, atau Selesai.' using errcode = 'P0001';
    end if;
    if not v_terpasang and p_status not in ('diajukan', 'terlambat', 'dibatalkan') then
      raise exception 'Unit belum dipasang: status hanya bisa Diajukan, Terlambat, atau Dibatalkan.' using errcode = 'P0001';
    end if;
  end if;

  if p_status = 'terlambat' and p_tgl_rencana_kembali > now() then
    raise exception 'Status Terlambat hanya untuk rencana kembali yang sudah lewat.' using errcode = 'P0001';
  end if;
  if p_status in ('diajukan', 'dipinjam') and p_tgl_rencana_kembali <= now() then
    raise exception 'Rencana kembali sudah lewat, pilih status Terlambat.' using errcode = 'P0001';
  end if;

  v_aktif_lama := v_p.status in ('diajukan', 'dipinjam', 'terlambat');
  v_aktif_baru := p_status in ('diajukan', 'dipinjam', 'terlambat');

  perform 1 from public.aset a
  where a.id in (select aset_id from public.detail_peminjaman where peminjaman_id = v_p.id)
  order by a.id for update;

  -- Diaktifkan kembali: unit harus masih tersedia dan tidak dipakai peminjaman lain.
  if v_aktif_baru and not v_aktif_lama then
    select string_agg(a.kode_aset, ', ' order by a.kode_aset) into v_bentrok
    from public.detail_peminjaman d
    join public.aset a on a.id = d.aset_id
    where d.peminjaman_id = v_p.id
      and (a.status <> 'tersedia' or public.aset_terikat(a.id, v_p.id));
    if v_bentrok is not null then
      raise exception 'Unit % sudah tidak tersedia, peminjaman tidak dapat diaktifkan kembali.', v_bentrok
        using errcode = 'P0001';
    end if;
  end if;

  if trim(p_nama_peminjam)   is distinct from v_p.nama_peminjam   then v_berubah := array_append(v_berubah, 'nama'); end if;
  if trim(p_divisi_peminjam) is distinct from v_p.divisi_peminjam then v_berubah := array_append(v_berubah, 'divisi'); end if;
  if trim(p_kontak_peminjam) is distinct from v_p.kontak_peminjam then v_berubah := array_append(v_berubah, 'kontak'); end if;
  if trim(p_ruangan)         is distinct from v_p.ruangan         then v_berubah := array_append(v_berubah, 'ruangan'); end if;
  if trim(p_keperluan)       is distinct from v_p.keperluan       then v_berubah := array_append(v_berubah, 'keperluan'); end if;
  if p_tgl_peminjaman        is distinct from v_p.tgl_peminjaman  then v_berubah := array_append(v_berubah, 'tanggal keluar'); end if;
  if p_tgl_rencana_kembali   is distinct from v_p.tgl_rencana_kembali then v_berubah := array_append(v_berubah, 'rencana kembali'); end if;

  if cardinality(v_berubah) = 0 and p_status = v_p.status then
    return; -- tidak ada perubahan
  end if;

  update public.peminjaman
     set nama_peminjam = trim(p_nama_peminjam),
         divisi_peminjam = trim(p_divisi_peminjam),
         kontak_peminjam = trim(p_kontak_peminjam),
         ruangan = trim(p_ruangan),
         keperluan = trim(p_keperluan),
         tgl_peminjaman = p_tgl_peminjaman,
         tgl_rencana_kembali = p_tgl_rencana_kembali
   where id = v_p.id;

  -- Catatan perubahan data di timeline (status lama = status baru).
  if cardinality(v_berubah) > 0 then
    insert into public.log_peminjaman (peminjaman_id, status_lama, status_baru, staff_id, keterangan)
    values (v_p.id, v_p.status, v_p.status, (select auth.uid()),
            'Data diperbaiki: ' || array_to_string(v_berubah, ', ') || '.' || coalesce(' ' || v_ket, ''));
  end if;

  if p_status <> v_p.status then
    perform set_config('app.ubah_manual', 'on', true);
    perform set_config('app.alur_peminjaman', 'on', true);
    perform set_config('app.keterangan_log', 'Status diubah manual.' || coalesce(' ' || v_ket, ''), true);

    update public.peminjaman set status = p_status where id = v_p.id;

    if v_terpasang then
      if v_aktif_lama and not v_aktif_baru then
        -- Ditutup manual tanpa pengembalian: unit yang masih dipinjam kembali tersedia.
        update public.aset a set status = 'tersedia'
          from public.detail_peminjaman d
         where d.peminjaman_id = v_p.id and a.id = d.aset_id and a.status = 'dipinjam';
      elsif v_aktif_baru and not v_aktif_lama then
        update public.aset a set status = 'dipinjam'
          from public.detail_peminjaman d
         where d.peminjaman_id = v_p.id and a.id = d.aset_id;
      end if;
    end if;

    perform set_config('app.keterangan_log', '', true);
    perform set_config('app.alur_peminjaman', '', true);
    perform set_config('app.ubah_manual', '', true);

    if p_status = 'terlambat' then
      perform public.kirim_notifikasi(
        'peminjaman.view',
        v_p.id,
        format('Peminjaman %s (%s, %s) terlambat. Rencana kembali %s WITA.',
               v_p.kode_peminjaman, trim(p_nama_peminjam), trim(p_ruangan),
               to_char(p_tgl_rencana_kembali at time zone 'Asia/Makassar', 'DD/MM/YYYY HH24:MI')),
        'terlambat'
      );
    end if;
  end if;
end;
$$;

revoke execute on function public.ubah_peminjaman(bigint, text, text, text, text, text, timestamptz, timestamptz, public.status_peminjaman, text) from public, anon;
grant execute on function public.ubah_peminjaman(bigint, text, text, text, text, text, timestamptz, timestamptz, public.status_peminjaman, text) to authenticated;
