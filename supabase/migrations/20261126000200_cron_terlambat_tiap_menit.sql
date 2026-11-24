-- Status Terlambat otomatis diperiksa setiap menit (sebelumnya setiap 15 menit).
-- tandai_terlambat() ringan (< 0,1 detik) dan notifikasi terlambat dijaga unique index,
-- jadi menjalankannya lebih sering tidak menimbulkan notifikasi ganda.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'tandai-peminjaman-terlambat') then
    perform cron.unschedule('tandai-peminjaman-terlambat');
  end if;
  perform cron.schedule('tandai-peminjaman-terlambat', '* * * * *', 'select public.tandai_terlambat();');
end;
$$;
