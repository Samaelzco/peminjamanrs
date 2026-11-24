-- service_role (script pemeliharaan, bukan pengguna aplikasi) boleh memulihkan status aset.
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
     and coalesce(current_setting('app.alur_peminjaman', true), '') <> 'on'
     and current_user <> 'service_role' then
    raise exception 'Status "dipinjam" hanya diatur oleh alur peminjaman dan tidak dapat diubah manual.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;
