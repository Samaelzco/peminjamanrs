-- =====================================================================
-- Halaman /debug: reset data demo
-- =====================================================================

insert into public.permissions (nama, modul, deskripsi)
values ('debug.reset', 'Debug', 'Mereset data transaksi ke kondisi awal demo (halaman /debug)')
on conflict (nama) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.nama = 'Administrasi' and p.nama = 'debug.reset'
on conflict do nothing;

-- Kosongkan semua transaksi dan kembalikan kategori + 8 aset demo ke tersedia/baik.
-- Akun, role, dan permission tidak disentuh. Foto di Storage dihapus oleh server action
-- (Supabase tidak mengizinkan hapus langsung dari storage.objects lewat SQL).
create or replace function public.reset_data_demo()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_peminjaman int;
  v_aset_dihapus int;
  v_kategori_dihapus int;
begin
  select count(*) into v_peminjaman from public.peminjaman;

  truncate table
    public.foto_pemasangan,
    public.foto_pengembalian,
    public.pemasangan,
    public.pengembalian,
    public.penggantian_unit,
    public.log_peminjaman,
    public.notifikasi,
    public.detail_peminjaman,
    public.peminjaman
  restart identity;

  -- Kategori demo (tambahkan bila hilang).
  insert into public.kategori (nama, kode_prefix) values
    ('Laptop', 'LPT'), ('Proyektor', 'PRJ'), ('Webcam', 'WCM')
  on conflict do nothing;

  -- Hapus aset & kategori di luar data demo.
  delete from public.aset
  where kode_aset not in ('LPT-001','LPT-002','LPT-003','PRJ-001','PRJ-002','PRJ-003','WCM-001','WCM-002');
  get diagnostics v_aset_dihapus = row_count;

  delete from public.kategori where kode_prefix not in ('LPT', 'PRJ', 'WCM');
  get diagnostics v_kategori_dihapus = row_count;

  -- Status ke/dari 'dipinjam' hanya boleh lewat alur resmi; reset termasuk alur resmi.
  perform set_config('app.alur_peminjaman', 'on', true);

  insert into public.aset (kode_aset, nama_aset, kategori_id, kondisi, status)
  select d.kode, d.nama, k.id, 'baik', 'tersedia'
  from (values
    ('LPT-001', 'Laptop Lenovo ThinkPad E14', 'LPT'),
    ('LPT-002', 'Laptop Lenovo ThinkPad E14', 'LPT'),
    ('LPT-003', 'Laptop ASUS ExpertBook B1', 'LPT'),
    ('PRJ-001', 'Proyektor Epson EB-X51', 'PRJ'),
    ('PRJ-002', 'Proyektor Epson EB-X51', 'PRJ'),
    ('PRJ-003', 'Proyektor BenQ MX560', 'PRJ'),
    ('WCM-001', 'Webcam Logitech C920', 'WCM'),
    ('WCM-002', 'Webcam Logitech C920', 'WCM')
  ) as d(kode, nama, prefix)
  join public.kategori k on k.kode_prefix = d.prefix
  where not exists (select 1 from public.aset a where a.kode_aset = d.kode);

  update public.aset set status = 'tersedia', kondisi = 'baik' where status <> 'tersedia' or kondisi <> 'baik';

  perform set_config('app.alur_peminjaman', '', true);

  return jsonb_build_object(
    'peminjaman_dihapus', v_peminjaman,
    'aset_lain_dihapus', v_aset_dihapus,
    'kategori_lain_dihapus', v_kategori_dihapus
  );
end;
$$;

revoke execute on function public.reset_data_demo() from public, anon, authenticated;
grant execute on function public.reset_data_demo() to service_role;
