-- Fungsi trigger tidak perlu bisa dipanggil lewat API (hasil advisor Supabase).
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.guard_role_manage_sendiri() from public, anon, authenticated;
revoke execute on function public.guard_hapus_role() from public, anon, authenticated;
revoke execute on function public.guard_update_staff() from public, anon, authenticated;
revoke execute on function public.guard_update_aset() from public, anon, authenticated;
revoke execute on function public.guard_insert_aset() from public, anon, authenticated;
revoke execute on function public.guard_status_peminjaman() from public, anon, authenticated;
revoke execute on function public.next_kode_peminjaman() from public, anon, authenticated;
