-- =====================================================================
-- Fase 4: Peminjaman, detail, notifikasi, log status
-- Semua perubahan lintas tabel lewat fungsi RPC (satu transaksi).
-- Client hanya punya hak SELECT pada tabel transaksi.
-- =====================================================================

create type public.status_peminjaman as enum ('diajukan', 'dipinjam', 'terlambat', 'dibatalkan', 'selesai');
create type public.kondisi_masuk as enum ('baik', 'rusak', 'hilang');

create sequence public.peminjaman_kode_seq;

create or replace function public.next_kode_peminjaman()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  n bigint := nextval('public.peminjaman_kode_seq');
begin
  return 'PJM-' || lpad(n::text, greatest(4, length(n::text)), '0');
end;
$$;

create table public.peminjaman (
  id                   bigint generated always as identity primary key,
  kode_peminjaman      text not null unique default public.next_kode_peminjaman(),
  dicatat_oleh         uuid not null references public.staff_it (id) on delete restrict,
  perpanjangan_dari    bigint unique references public.peminjaman (id) on delete restrict,
  nama_peminjam        text not null check (length(trim(nama_peminjam)) > 0),
  divisi_peminjam      text not null check (length(trim(divisi_peminjam)) > 0),
  kontak_peminjam      text not null check (length(trim(kontak_peminjam)) > 0),
  ruangan              text not null check (length(trim(ruangan)) > 0),
  keperluan            text not null check (length(trim(keperluan)) > 0),
  tgl_peminjaman       timestamptz not null,
  tgl_rencana_kembali  timestamptz not null,
  status               public.status_peminjaman not null default 'diajukan',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint peminjaman_tanggal_valid check (tgl_rencana_kembali > tgl_peminjaman)
);
create index peminjaman_status_idx on public.peminjaman (status);
create index peminjaman_dicatat_oleh_idx on public.peminjaman (dicatat_oleh);
create index peminjaman_tgl_peminjaman_idx on public.peminjaman (tgl_peminjaman desc);

create table public.detail_peminjaman (
  id              bigint generated always as identity primary key,
  peminjaman_id   bigint not null references public.peminjaman (id) on delete cascade,
  aset_id         bigint not null references public.aset (id) on delete restrict,
  kondisi_keluar  public.kondisi_aset,
  kondisi_masuk   public.kondisi_masuk,
  catatan         text,
  unique (peminjaman_id, aset_id)
);
create index detail_peminjaman_aset_id_idx on public.detail_peminjaman (aset_id);

create table public.notifikasi (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.staff_it (id) on delete cascade,
  peminjaman_id  bigint references public.peminjaman (id) on delete cascade,
  pesan          text not null,
  sudah_dibaca   boolean not null default false,
  created_at     timestamptz not null default now()
);
create index notifikasi_user_idx on public.notifikasi (user_id, sudah_dibaca, created_at desc);
create index notifikasi_peminjaman_idx on public.notifikasi (peminjaman_id);

-- Log perubahan status (untuk timeline di halaman detail).
create table public.log_peminjaman (
  id             bigint generated always as identity primary key,
  peminjaman_id  bigint not null references public.peminjaman (id) on delete cascade,
  status_lama    public.status_peminjaman,
  status_baru    public.status_peminjaman not null,
  staff_id       uuid references public.staff_it (id) on delete set null,
  keterangan     text,
  created_at     timestamptz not null default now()
);
create index log_peminjaman_peminjaman_idx on public.log_peminjaman (peminjaman_id, created_at);

create trigger peminjaman_set_updated_at before update on public.peminjaman
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Transisi status yang sah (6.9)
-- ---------------------------------------------------------------------
create or replace function public.guard_status_peminjaman()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'diajukan' or (new.status = 'dipinjam' and new.perpanjangan_dari is not null) then
      return new;
    end if;
    raise exception 'Peminjaman baru tidak boleh berstatus "%".', new.status using errcode = 'P0001';
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if (old.status, new.status) in (
       ('diajukan'::public.status_peminjaman,  'dipinjam'::public.status_peminjaman),
       ('diajukan',  'dibatalkan'),
       ('dipinjam',  'terlambat'),
       ('dipinjam',  'selesai'),
       ('terlambat', 'selesai')) then
    return new;
  end if;

  raise exception 'Transisi status peminjaman dari "%" ke "%" tidak diizinkan.', old.status, new.status
    using errcode = 'P0001';
end;
$$;

create trigger peminjaman_guard_status
  before insert or update of status on public.peminjaman
  for each row execute function public.guard_status_peminjaman();

-- Catat setiap perubahan status ke log_peminjaman.
create or replace function public.log_status_peminjaman()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.log_peminjaman (peminjaman_id, status_lama, status_baru, staff_id, keterangan)
    values (
      new.id,
      case when tg_op = 'UPDATE' then old.status end,
      new.status,
      (select auth.uid()),
      nullif(current_setting('app.keterangan_log', true), '')
    );
  end if;
  return new;
end;
$$;

create trigger peminjaman_log_status
  after insert or update of status on public.peminjaman
  for each row execute function public.log_status_peminjaman();

-- Aset dengan riwayat peminjaman tidak dapat dihapus (pesan yang ramah).
create or replace function public.guard_hapus_aset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.detail_peminjaman where aset_id = old.id) then
    raise exception 'Aset % memiliki riwayat peminjaman dan tidak dapat dihapus.', old.kode_aset
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger aset_guard_hapus
  before delete on public.aset
  for each row execute function public.guard_hapus_aset();

-- ---------------------------------------------------------------------
-- Helper internal
-- ---------------------------------------------------------------------

-- Aset sedang terikat peminjaman aktif (diajukan / dipinjam / terlambat)?
create or replace function public.aset_terikat(p_aset_id bigint, p_kecuali_peminjaman bigint default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.detail_peminjaman d
    join public.peminjaman p on p.id = d.peminjaman_id
    where d.aset_id = p_aset_id
      and p.status in ('diajukan', 'dipinjam', 'terlambat')
      and (p_kecuali_peminjaman is null or p.id <> p_kecuali_peminjaman)
  );
$$;

-- Kirim notifikasi ke semua user aktif yang punya permission tertentu.
create or replace function public.kirim_notifikasi(p_permission text, p_peminjaman_id bigint, p_pesan text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifikasi (user_id, peminjaman_id, pesan)
  select distinct s.id, p_peminjaman_id, p_pesan
  from public.staff_it s
  join public.role_permissions rp on rp.role_id = s.role_id
  join public.permissions p on p.id = rp.permission_id
  where s.status = 'aktif' and p.nama = p_permission;
$$;

create or replace function public.wajib_permission(p_permission text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission(p_permission) then
    raise exception 'Anda tidak punya izin untuk melakukan aksi ini.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.aset_terikat(bigint, bigint) from public, anon, authenticated;
revoke execute on function public.kirim_notifikasi(text, bigint, text) from public, anon, authenticated;
revoke execute on function public.wajib_permission(text) from public, anon, authenticated;
revoke execute on function public.log_status_peminjaman() from public, anon, authenticated;
revoke execute on function public.guard_hapus_aset() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6.1 Unit tersedia untuk dipilih
-- ---------------------------------------------------------------------
create or replace function public.aset_tersedia(p_kategori_id bigint, p_kecuali_aset bigint[] default '{}')
returns table (id bigint, kode_aset text, nama_aset text, kategori_id bigint, kategori_nama text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not (public.has_permission('peminjaman.create') or public.has_permission('pemasangan.create')) then
    raise exception 'Anda tidak punya izin untuk melakukan aksi ini.' using errcode = '42501';
  end if;

  return query
    select a.id, a.kode_aset, a.nama_aset, a.kategori_id, k.nama
    from public.aset a
    join public.kategori k on k.id = a.kategori_id
    where a.kategori_id = p_kategori_id
      and a.status = 'tersedia'
      and not (a.id = any (coalesce(p_kecuali_aset, '{}')))
      and not public.aset_terikat(a.id)
    order by length(a.kode_aset), a.kode_aset;
end;
$$;

-- 6.2 langkah 2–3: ambil N unit tersedia dengan kode terkecil, atau tolak semuanya.
create or replace function public.ambil_unit_tersedia(
  p_kategori_id bigint,
  p_jumlah int,
  p_kecuali_aset bigint[] default '{}'
)
returns table (id bigint, kode_aset text, nama_aset text, kategori_id bigint, kategori_nama text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_tersedia int;
  v_kategori text;
begin
  perform public.wajib_permission('peminjaman.create');

  if p_jumlah is null or p_jumlah < 1 then
    raise exception 'Jumlah unit minimal 1.' using errcode = 'P0001';
  end if;

  select nama into v_kategori from public.kategori where public.kategori.id = p_kategori_id;
  if v_kategori is null then
    raise exception 'Kategori tidak ditemukan.' using errcode = 'P0001';
  end if;

  select count(*) into v_tersedia from public.aset_tersedia(p_kategori_id, p_kecuali_aset);
  if v_tersedia < p_jumlah then
    raise exception 'Hanya tersedia % unit %.', v_tersedia, v_kategori using errcode = 'P0001';
  end if;

  return query
    select * from public.aset_tersedia(p_kategori_id, p_kecuali_aset) limit p_jumlah;
end;
$$;

-- ---------------------------------------------------------------------
-- 6.2 Membuat peminjaman (penolakan peminjaman ganda)
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
  v_ids       bigint[];
  v_bentrok   text;
  v_hilang    int;
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

  insert into public.peminjaman (
    dicatat_oleh, nama_peminjam, divisi_peminjam, kontak_peminjam, ruangan, keperluan,
    tgl_peminjaman, tgl_rencana_kembali, status
  ) values (
    (select auth.uid()), trim(p_nama_peminjam), trim(p_divisi_peminjam), trim(p_kontak_peminjam),
    trim(p_ruangan), trim(p_keperluan), p_tgl_peminjaman, p_tgl_rencana_kembali, 'diajukan'
  )
  returning * into v_peminjaman;

  insert into public.detail_peminjaman (peminjaman_id, aset_id)
  select v_peminjaman.id, x from unnest(v_ids) x;

  perform public.kirim_notifikasi(
    'pemasangan.create',
    v_peminjaman.id,
    format('Peminjaman %s (%s, %s) menunggu pemasangan.',
           v_peminjaman.kode_peminjaman, v_peminjaman.nama_peminjam, v_peminjaman.ruangan)
  );

  return query select v_peminjaman.id, v_peminjaman.kode_peminjaman;
end;
$$;

-- ---------------------------------------------------------------------
-- 6.7 Pembatalan
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
  if v_status <> 'diajukan' then
    raise exception 'Hanya peminjaman berstatus diajukan yang dapat dibatalkan.' using errcode = 'P0001';
  end if;

  perform set_config('app.keterangan_log', coalesce(nullif(trim(p_alasan), ''), 'Dibatalkan'), true);
  update public.peminjaman set status = 'dibatalkan' where id = p_peminjaman_id;
  perform set_config('app.keterangan_log', '', true);
end;
$$;

revoke execute on function public.aset_tersedia(bigint, bigint[]) from public, anon;
revoke execute on function public.ambil_unit_tersedia(bigint, int, bigint[]) from public, anon;
revoke execute on function public.buat_peminjaman(text, text, text, text, text, timestamptz, timestamptz, bigint[]) from public, anon;
revoke execute on function public.batalkan_peminjaman(bigint, text) from public, anon;
grant execute on function public.aset_tersedia(bigint, bigint[]) to authenticated;
grant execute on function public.ambil_unit_tersedia(bigint, int, bigint[]) to authenticated;
grant execute on function public.buat_peminjaman(text, text, text, text, text, timestamptz, timestamptz, bigint[]) to authenticated;
grant execute on function public.batalkan_peminjaman(bigint, text) to authenticated;

-- ---------------------------------------------------------------------
-- Grant + RLS
-- ---------------------------------------------------------------------
revoke all on public.peminjaman, public.detail_peminjaman, public.notifikasi, public.log_peminjaman from anon;
revoke all on public.peminjaman, public.detail_peminjaman, public.log_peminjaman from authenticated;
revoke all on public.notifikasi from authenticated;
grant select on public.peminjaman, public.detail_peminjaman, public.log_peminjaman to authenticated;
grant select on public.notifikasi to authenticated;
grant update (sudah_dibaca) on public.notifikasi to authenticated;
grant all on public.peminjaman, public.detail_peminjaman, public.notifikasi, public.log_peminjaman to service_role;
grant usage, select on sequence public.peminjaman_kode_seq to service_role;

alter table public.peminjaman enable row level security;
alter table public.detail_peminjaman enable row level security;
alter table public.notifikasi enable row level security;
alter table public.log_peminjaman enable row level security;

create policy "peminjaman: baca" on public.peminjaman
  for select to authenticated using (
    (select public.has_permission('peminjaman.view')) or (select public.has_permission('riwayat.view'))
  );
create policy "detail_peminjaman: baca" on public.detail_peminjaman
  for select to authenticated using (
    (select public.has_permission('peminjaman.view')) or (select public.has_permission('riwayat.view'))
  );
create policy "log_peminjaman: baca" on public.log_peminjaman
  for select to authenticated using (
    (select public.has_permission('peminjaman.view')) or (select public.has_permission('riwayat.view'))
  );

create policy "notifikasi: baca milik sendiri" on public.notifikasi
  for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active_user()));
create policy "notifikasi: tandai dibaca milik sendiri" on public.notifikasi
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active_user()))
  with check (user_id = (select auth.uid()));
