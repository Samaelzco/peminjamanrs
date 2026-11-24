-- =====================================================================
-- Fase 3: Data master (kategori, aset)
-- =====================================================================

create type public.kondisi_aset as enum ('baik', 'rusak');
create type public.status_aset as enum ('tersedia', 'dipinjam', 'dalam_perbaikan', 'hilang');

create table public.kategori (
  id           bigint generated always as identity primary key,
  nama         text not null unique check (length(trim(nama)) > 0),
  kode_prefix  text not null unique check (kode_prefix ~ '^[A-Z]{2,5}$'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.aset (
  id           bigint generated always as identity primary key,
  kode_aset    text not null unique,
  nama_aset    text not null check (length(trim(nama_aset)) > 0),
  kategori_id  bigint not null references public.kategori (id) on delete restrict,
  deskripsi    text,
  kondisi      public.kondisi_aset not null default 'baik',
  status       public.status_aset not null default 'tersedia',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index aset_kategori_id_idx on public.aset (kategori_id);
create index aset_status_idx on public.aset (status);

create trigger kategori_set_updated_at before update on public.kategori
  for each row execute function public.set_updated_at();
create trigger aset_set_updated_at before update on public.aset
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Kode aset otomatis: <kode_prefix>-<nomor urut 3 digit>, mis. LPT-001
-- ---------------------------------------------------------------------
create or replace function public.aset_generate_kode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_next   int;
begin
  -- Kunci baris kategori supaya dua insert bersamaan tidak mendapat nomor sama.
  select kode_prefix into v_prefix from public.kategori where id = new.kategori_id for update;
  if v_prefix is null then
    raise exception 'Kategori tidak ditemukan.' using errcode = 'P0001';
  end if;

  if new.kode_aset is null or new.kode_aset = '' then
    select coalesce(max(substring(kode_aset from length(v_prefix) + 2)::int), 0) + 1
      into v_next
      from public.aset
     where kode_aset ~ ('^' || v_prefix || '-[0-9]+$');
    new.kode_aset := v_prefix || '-' || lpad(v_next::text, greatest(3, length(v_next::text)), '0');
  elsif new.kode_aset !~ ('^' || v_prefix || '-[0-9]{3,}$') then
    raise exception 'Kode aset % tidak sesuai prefix kategori %.', new.kode_aset, v_prefix
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger aset_generate_kode
  before insert on public.aset
  for each row execute function public.aset_generate_kode();

-- ---------------------------------------------------------------------
-- Aturan perubahan aset
--  * kode_aset dan kategori tidak dapat diubah (kode bergantung pada kategori).
--  * Status ke / dari 'dipinjam' hanya boleh diatur oleh alur peminjaman
--    (fungsi RPC menyalakan flag app.alur_peminjaman di transaksinya).
-- ---------------------------------------------------------------------
create or replace function public.guard_update_aset()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kode_aset is distinct from old.kode_aset then
    raise exception 'Kode aset tidak dapat diubah.' using errcode = 'P0001';
  end if;
  if new.kategori_id is distinct from old.kategori_id then
    raise exception 'Kategori aset tidak dapat diubah.' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status
     and (old.status = 'dipinjam' or new.status = 'dipinjam')
     and coalesce(current_setting('app.alur_peminjaman', true), '') <> 'on' then
    raise exception 'Status "dipinjam" hanya diatur oleh alur peminjaman dan tidak dapat diubah manual.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger aset_guard_update
  before update on public.aset
  for each row execute function public.guard_update_aset();

-- Aset baru tidak boleh langsung berstatus 'dipinjam'.
create or replace function public.guard_insert_aset()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'dipinjam' then
    raise exception 'Aset baru tidak dapat berstatus "dipinjam".' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger aset_guard_insert
  before insert on public.aset
  for each row execute function public.guard_insert_aset();

-- ---------------------------------------------------------------------
-- Aturan kategori
--  * kode_prefix tidak dapat diubah kalau kategori sudah punya aset.
--  * Kategori yang masih punya aset tidak dapat dihapus.
-- ---------------------------------------------------------------------
create or replace function public.guard_update_kategori()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kode_prefix is distinct from old.kode_prefix
     and exists (select 1 from public.aset where kategori_id = old.id) then
    raise exception 'Kode prefix tidak dapat diubah karena kategori "%" sudah memiliki aset.', old.nama
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger kategori_guard_update
  before update on public.kategori
  for each row execute function public.guard_update_kategori();

create or replace function public.guard_hapus_kategori()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jumlah int;
begin
  select count(*) into v_jumlah from public.aset where kategori_id = old.id;
  if v_jumlah > 0 then
    raise exception 'Kategori "%" masih memiliki % aset dan tidak dapat dihapus.', old.nama, v_jumlah
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger kategori_guard_hapus
  before delete on public.kategori
  for each row execute function public.guard_hapus_kategori();

revoke execute on function public.aset_generate_kode() from public, anon, authenticated;
revoke execute on function public.guard_update_kategori() from public, anon, authenticated;
revoke execute on function public.guard_hapus_kategori() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Grant + RLS
-- ---------------------------------------------------------------------
revoke all on public.kategori, public.aset from anon;
grant select, insert, update, delete on public.kategori to authenticated;
grant select, insert, update, delete on public.aset to authenticated;
grant all on public.kategori, public.aset to service_role;

alter table public.kategori enable row level security;
alter table public.aset enable row level security;

-- Data master dibaca oleh modul yang membutuhkannya.
create policy "kategori: baca" on public.kategori
  for select to authenticated using (
    (select public.has_permission('kategori.view'))
    or (select public.has_permission('aset.view'))
    or (select public.has_permission('peminjaman.view'))
    or (select public.has_permission('peminjaman.create'))
    or (select public.has_permission('riwayat.view'))
  );
create policy "kategori: tambah" on public.kategori
  for insert to authenticated with check ((select public.has_permission('kategori.create')));
create policy "kategori: ubah" on public.kategori
  for update to authenticated
  using ((select public.has_permission('kategori.update')))
  with check ((select public.has_permission('kategori.update')));
create policy "kategori: hapus" on public.kategori
  for delete to authenticated using ((select public.has_permission('kategori.delete')));

create policy "aset: baca" on public.aset
  for select to authenticated using (
    (select public.has_permission('aset.view'))
    or (select public.has_permission('peminjaman.view'))
    or (select public.has_permission('peminjaman.create'))
    or (select public.has_permission('riwayat.view'))
  );
create policy "aset: tambah" on public.aset
  for insert to authenticated with check ((select public.has_permission('aset.create')));
create policy "aset: ubah" on public.aset
  for update to authenticated
  using ((select public.has_permission('aset.update')))
  with check ((select public.has_permission('aset.update')));
create policy "aset: hapus" on public.aset
  for delete to authenticated using ((select public.has_permission('aset.delete')));
