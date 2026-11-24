-- Validasi input di lapis database (berlaku juga untuk pemanggilan API/RPC langsung).
-- Batas sama dengan lib/validation.ts; keperluan diberi ruang lebih karena
-- setiap perpanjangan menambahkan alasan ke keperluan.

alter table public.peminjaman
  add constraint peminjaman_nama_panjang      check (char_length(nama_peminjam) <= 100),
  add constraint peminjaman_divisi_panjang    check (char_length(divisi_peminjam) <= 100),
  add constraint peminjaman_ruangan_panjang   check (char_length(ruangan) <= 100),
  add constraint peminjaman_keperluan_panjang check (char_length(keperluan) <= 2000),
  -- Hanya angka (boleh + di depan dan pemisah spasi/tanda hubung), 8–20 karakter: tidak ada huruf.
  add constraint peminjaman_kontak_format     check (
    kontak_peminjam ~ '^\+?[0-9]+([ -][0-9]+)*$' and char_length(kontak_peminjam) between 8 and 20
  );

alter table public.detail_peminjaman
  add constraint detail_catatan_panjang check (catatan is null or char_length(catatan) <= 500);

alter table public.penggantian_unit
  add constraint penggantian_alasan_panjang check (char_length(alasan) <= 300);

alter table public.aset
  add constraint aset_nama_panjang      check (char_length(nama_aset) <= 100),
  add constraint aset_deskripsi_panjang check (deskripsi is null or char_length(deskripsi) <= 500);

alter table public.kategori
  add constraint kategori_nama_panjang check (char_length(nama) <= 50);

alter table public.roles
  add constraint roles_nama_panjang      check (char_length(nama) <= 50),
  add constraint roles_deskripsi_panjang check (deskripsi is null or char_length(deskripsi) <= 255);

alter table public.staff_it
  add constraint staff_nama_panjang  check (char_length(nama) <= 100),
  add constraint staff_email_panjang check (char_length(email) <= 254);

alter table public.notifikasi
  add constraint notifikasi_pesan_panjang check (char_length(pesan) <= 1000);
