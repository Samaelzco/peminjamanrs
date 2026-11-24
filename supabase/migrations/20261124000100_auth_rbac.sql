-- =====================================================================
-- Fase 2: Akun dan RBAC (meniru Laravel Spatie)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Utilitas umum
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------
create type public.status_akun as enum ('aktif', 'non_aktif');

create table public.roles (
  id          bigint generated always as identity primary key,
  nama        text not null unique check (length(trim(nama)) > 0),
  deskripsi   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.permissions (
  id         bigint generated always as identity primary key,
  nama       text not null unique,
  modul      text not null,
  deskripsi  text
);

create table public.role_permissions (
  role_id        bigint not null references public.roles (id) on delete cascade,
  permission_id  bigint not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);
create index role_permissions_permission_id_idx on public.role_permissions (permission_id);

create table public.staff_it (
  id          uuid primary key references auth.users (id) on delete cascade,
  nama        text not null check (length(trim(nama)) > 0),
  email       text not null unique,
  role_id     bigint not null references public.roles (id) on delete restrict,
  status      public.status_akun not null default 'aktif',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index staff_it_role_id_idx on public.staff_it (role_id);

create trigger roles_set_updated_at before update on public.roles
  for each row execute function public.set_updated_at();
create trigger staff_it_set_updated_at before update on public.staff_it
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Fungsi hak akses
-- ---------------------------------------------------------------------

-- User aktif yang sedang login? (user non-aktif tidak punya akses apa pun)
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_it s
    where s.id = (select auth.uid()) and s.status = 'aktif'
  );
$$;

create or replace function public.has_permission(nama_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_it s
    join public.role_permissions rp on rp.role_id = s.role_id
    join public.permissions p on p.id = rp.permission_id
    where s.id = (select auth.uid())
      and s.status = 'aktif'
      and p.nama = nama_permission
  );
$$;

-- Semua permission milik user yang sedang login (dipakai helper can() di Next.js)
create or replace function public.my_permissions()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select p.nama
  from public.staff_it s
  join public.role_permissions rp on rp.role_id = s.role_id
  join public.permissions p on p.id = rp.permission_id
  where s.id = (select auth.uid())
    and s.status = 'aktif';
$$;

revoke execute on function public.is_active_user() from public, anon;
revoke execute on function public.has_permission(text) from public, anon;
revoke execute on function public.my_permissions() from public, anon;
grant execute on function public.is_active_user() to authenticated, service_role;
grant execute on function public.has_permission(text) to authenticated, service_role;
grant execute on function public.my_permissions() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Aturan pengaman
-- ---------------------------------------------------------------------

-- 1) User tidak boleh mencabut role.manage dari role miliknya sendiri.
create or replace function public.guard_role_manage_sendiri()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_saya bigint;
begin
  if (select auth.uid()) is null then
    return old; -- service role / proses internal
  end if;

  select role_id into v_role_saya from public.staff_it where id = (select auth.uid());

  if old.role_id = v_role_saya
     and exists (select 1 from public.permissions p
                 where p.id = old.permission_id and p.nama = 'role.manage')
     and exists (select 1 from public.roles r where r.id = old.role_id) then
    raise exception 'Tidak dapat menonaktifkan permission role.manage pada role Anda sendiri.'
      using errcode = 'P0001';
  end if;

  return old;
end;
$$;

create trigger role_permissions_guard_role_manage
  before delete on public.role_permissions
  for each row execute function public.guard_role_manage_sendiri();

-- 2) Role yang masih dipakai user tidak boleh dihapus (pesan yang ramah).
create or replace function public.guard_hapus_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jumlah int;
begin
  select count(*) into v_jumlah from public.staff_it where role_id = old.id;
  if v_jumlah > 0 then
    raise exception 'Role "%" masih dipakai oleh % akun dan tidak dapat dihapus.', old.nama, v_jumlah
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger roles_guard_hapus
  before delete on public.roles
  for each row execute function public.guard_hapus_role();

-- 3) Perubahan staff_it: status butuh user.toggle-status, kolom lain butuh user.update.
--    User tidak boleh mengubah role atau menonaktifkan akunnya sendiri.
create or replace function public.guard_update_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new; -- service role / proses internal
  end if;

  if new.id <> old.id then
    raise exception 'ID akun tidak dapat diubah.' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    if not public.has_permission('user.toggle-status') then
      raise exception 'Anda tidak punya izin mengubah status akun.' using errcode = '42501';
    end if;
    if old.id = (select auth.uid()) then
      raise exception 'Anda tidak dapat menonaktifkan akun Anda sendiri.' using errcode = 'P0001';
    end if;
  end if;

  if (new.nama, new.email, new.role_id) is distinct from (old.nama, old.email, old.role_id) then
    if not public.has_permission('user.update') then
      raise exception 'Anda tidak punya izin mengubah data akun.' using errcode = '42501';
    end if;
    if old.id = (select auth.uid()) and new.role_id is distinct from old.role_id then
      raise exception 'Anda tidak dapat mengubah role akun Anda sendiri.' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger staff_it_guard_update
  before update on public.staff_it
  for each row execute function public.guard_update_staff();

-- ---------------------------------------------------------------------
-- Hak akses tabel (grant) + RLS
-- ---------------------------------------------------------------------
revoke all on public.roles, public.permissions, public.role_permissions, public.staff_it from anon;

grant select, insert, update, delete on public.roles to authenticated;
grant select on public.permissions to authenticated;              -- permission tidak bisa diubah dari aplikasi
grant select, insert, delete on public.role_permissions to authenticated;
grant select, insert, update on public.staff_it to authenticated;  -- akun tidak dihapus, hanya dinonaktifkan

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_it enable row level security;

-- roles
create policy "roles: baca (user aktif)" on public.roles
  for select to authenticated using ((select public.is_active_user()));
create policy "roles: tambah" on public.roles
  for insert to authenticated with check ((select public.has_permission('role.manage')));
create policy "roles: ubah" on public.roles
  for update to authenticated
  using ((select public.has_permission('role.manage')))
  with check ((select public.has_permission('role.manage')));
create policy "roles: hapus" on public.roles
  for delete to authenticated using ((select public.has_permission('role.manage')));

-- permissions (hanya baca)
create policy "permissions: baca (user aktif)" on public.permissions
  for select to authenticated using ((select public.is_active_user()));

-- role_permissions
create policy "role_permissions: baca (user aktif)" on public.role_permissions
  for select to authenticated using ((select public.is_active_user()));
create policy "role_permissions: tambah" on public.role_permissions
  for insert to authenticated with check ((select public.has_permission('role.manage')));
create policy "role_permissions: hapus" on public.role_permissions
  for delete to authenticated using ((select public.has_permission('role.manage')));

-- staff_it
create policy "staff_it: baca diri sendiri atau user.view" on public.staff_it
  for select to authenticated
  using (id = (select auth.uid()) or (select public.has_permission('user.view')));
create policy "staff_it: tambah" on public.staff_it
  for insert to authenticated with check ((select public.has_permission('user.create')));
create policy "staff_it: ubah" on public.staff_it
  for update to authenticated
  using ((select public.has_permission('user.update')) or (select public.has_permission('user.toggle-status')))
  with check ((select public.has_permission('user.update')) or (select public.has_permission('user.toggle-status')));

-- ---------------------------------------------------------------------
-- Seed permission dan role awal
-- ---------------------------------------------------------------------
insert into public.permissions (nama, modul, deskripsi) values
  ('dashboard.view',       'Dashboard',    'Melihat dashboard'),
  ('user.view',            'Akun',         'Melihat daftar akun'),
  ('user.create',          'Akun',         'Menambah akun'),
  ('user.update',          'Akun',         'Mengubah data akun'),
  ('user.toggle-status',   'Akun',         'Mengaktifkan / menonaktifkan akun'),
  ('role.view',            'Role',         'Melihat daftar role'),
  ('role.manage',          'Role',         'Mengelola role dan permission'),
  ('kategori.view',        'Kategori',     'Melihat kategori'),
  ('kategori.create',      'Kategori',     'Menambah kategori'),
  ('kategori.update',      'Kategori',     'Mengubah kategori'),
  ('kategori.delete',      'Kategori',     'Menghapus kategori'),
  ('aset.view',            'Aset',         'Melihat data aset'),
  ('aset.create',          'Aset',         'Menambah aset'),
  ('aset.update',          'Aset',         'Mengubah aset'),
  ('aset.delete',          'Aset',         'Menghapus aset'),
  ('peminjaman.view',      'Peminjaman',   'Melihat peminjaman'),
  ('peminjaman.create',    'Peminjaman',   'Membuat peminjaman'),
  ('peminjaman.cancel',    'Peminjaman',   'Membatalkan peminjaman'),
  ('peminjaman.extend',    'Peminjaman',   'Memperpanjang peminjaman'),
  ('pemasangan.create',    'Pemasangan',   'Mencatat pemasangan'),
  ('pengembalian.create',  'Pengembalian', 'Mencatat pengembalian'),
  ('riwayat.view',         'Riwayat',      'Melihat riwayat peminjaman');

insert into public.roles (nama, deskripsi) values
  ('Administrasi',         'Admin: mengelola akun, role, dan peminjaman'),
  ('Sarana dan Prasarana', 'Sarpras: mengelola aset, pemasangan, dan pengembalian');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on
  (r.nama = 'Administrasi' and (
     p.nama in ('dashboard.view', 'kategori.view', 'aset.view', 'riwayat.view')
     or p.nama like 'user.%'
     or p.nama like 'role.%'
     or p.nama like 'peminjaman.%'))
  or
  (r.nama = 'Sarana dan Prasarana' and (
     p.nama in ('dashboard.view', 'peminjaman.view', 'pemasangan.create', 'pengembalian.create', 'riwayat.view')
     or p.nama like 'kategori.%'
     or p.nama like 'aset.%'));
