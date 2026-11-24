-- Nama petugas untuk ditampilkan di timeline/detail tanpa membuka tabel staff_it
-- (yang hanya boleh dibaca dengan user.view).
create or replace function public.nama_staff(p_ids uuid[])
returns table (id uuid, nama text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.nama
  from public.staff_it s
  where s.id = any (p_ids)
    and public.is_active_user();
$$;

revoke execute on function public.nama_staff(uuid[]) from public, anon;
grant execute on function public.nama_staff(uuid[]) to authenticated, service_role;
