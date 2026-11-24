-- Unduh rekap laporan (Excel) hanya untuk Administrasi.
insert into public.permissions (nama, modul, deskripsi) values
  ('laporan.export', 'Riwayat', 'Mengunduh rekap laporan peminjaman & keterlambatan (Excel)')
on conflict (nama) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.nama = 'Administrasi' and p.nama = 'laporan.export'
on conflict do nothing;
