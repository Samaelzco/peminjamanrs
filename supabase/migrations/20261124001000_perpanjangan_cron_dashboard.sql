-- =====================================================================
-- Fase 6: Perpanjangan, status Terlambat otomatis (pg_cron), dashboard
-- =====================================================================

-- Jenis notifikasi (untuk mencegah notifikasi ganda).
alter table public.notifikasi add column jenis text not null default 'info';
create unique index notifikasi_terlambat_unik
  on public.notifikasi (user_id, peminjaman_id)
  where jenis = 'terlambat';

create or replace function public.kirim_notifikasi(
  p_permission text,
  p_peminjaman_id bigint,
  p_pesan text,
  p_jenis text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifikasi (user_id, peminjaman_id, pesan, jenis)
  select distinct s.id, p_peminjaman_id, p_pesan, p_jenis
  from public.staff_it s
  join public.role_permissions rp on rp.role_id = s.role_id
  join public.permissions p on p.id = rp.permission_id
  where s.status = 'aktif' and p.nama = p_permission
  on conflict do nothing;
$$;

-- Versi lama (3 argumen) tetap ada untuk fungsi yang sudah memakainya.
create or replace function public.kirim_notifikasi(p_permission text, p_peminjaman_id bigint, p_pesan text)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.kirim_notifikasi(p_permission, p_peminjaman_id, p_pesan, 'info');
$$;

revoke execute on function public.kirim_notifikasi(text, bigint, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6.6 Perpanjangan: membuat peminjaman baru, menutup yang lama
-- ---------------------------------------------------------------------
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

revoke execute on function public.perpanjang_peminjaman(bigint, timestamptz, text) from public, anon;
grant execute on function public.perpanjang_peminjaman(bigint, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6.4 Status Terlambat otomatis
-- ---------------------------------------------------------------------
create or replace function public.tandai_terlambat()
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row    record;
  v_jumlah int := 0;
begin
  perform set_config('app.keterangan_log', 'Ditandai otomatis oleh sistem (pg_cron).', true);

  for v_row in
    update public.peminjaman
       set status = 'terlambat'
     where status = 'dipinjam'
       and tgl_rencana_kembali < now()
    returning id, kode_peminjaman, nama_peminjam, ruangan, tgl_rencana_kembali
  loop
    v_jumlah := v_jumlah + 1;
    perform public.kirim_notifikasi(
      'peminjaman.view',
      v_row.id,
      format('Peminjaman %s (%s, %s) terlambat. Rencana kembali %s WITA.',
             v_row.kode_peminjaman, v_row.nama_peminjam, v_row.ruangan,
             to_char(v_row.tgl_rencana_kembali at time zone 'Asia/Makassar', 'DD/MM/YYYY HH24:MI')),
      'terlambat'
    );
  end loop;

  perform set_config('app.keterangan_log', '', true);
  return v_jumlah;
end;
$$;

revoke execute on function public.tandai_terlambat() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'tandai-peminjaman-terlambat') then
    perform cron.unschedule('tandai-peminjaman-terlambat');
  end if;
  -- Jadwal pg_cron berjalan dalam UTC; setiap 15 menit tidak terpengaruh zona waktu.
  perform cron.schedule('tandai-peminjaman-terlambat', '*/15 * * * *', 'select public.tandai_terlambat();');
end;
$$;

-- ---------------------------------------------------------------------
-- Dashboard
-- ---------------------------------------------------------------------
create or replace function public.ringkasan_dashboard()
returns table (diajukan bigint, dipinjam bigint, terlambat bigint, aset_tersedia bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.wajib_permission('dashboard.view');
  return query
    select
      (select count(*) from public.peminjaman where status = 'diajukan'),
      (select count(*) from public.peminjaman where status = 'dipinjam'),
      (select count(*) from public.peminjaman where status = 'terlambat'),
      (select count(*) from public.aset a where a.status = 'tersedia' and not public.aset_terikat(a.id));
end;
$$;

revoke execute on function public.ringkasan_dashboard() from public, anon;
grant execute on function public.ringkasan_dashboard() to authenticated;

-- Tandai semua notifikasi milik sendiri sebagai dibaca.
create or replace function public.baca_semua_notifikasi()
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  update public.notifikasi set sudah_dibaca = true
  where user_id = (select auth.uid()) and sudah_dibaca = false;
$$;

revoke execute on function public.baca_semua_notifikasi() from public, anon;
grant execute on function public.baca_semua_notifikasi() to authenticated;
