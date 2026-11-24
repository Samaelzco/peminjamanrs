-- Kode peminjaman berurutan tanpa celah: max + 1, diserialkan dengan advisory lock
-- (dilepas saat transaksi selesai) supaya dua penyimpanan bersamaan tidak bentrok.
create or replace function public.next_kode_peminjaman()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n bigint;
begin
  perform pg_advisory_xact_lock(hashtext('public.peminjaman.kode_peminjaman'));
  select coalesce(max(substring(kode_peminjaman from 5)::bigint), 0) + 1
    into n
    from public.peminjaman
   where kode_peminjaman ~ '^PJM-[0-9]+$';
  return 'PJM-' || lpad(n::text, greatest(4, length(n::text)), '0');
end;
$$;

revoke execute on function public.next_kode_peminjaman() from public, anon, authenticated;
drop sequence if exists public.peminjaman_kode_seq;
