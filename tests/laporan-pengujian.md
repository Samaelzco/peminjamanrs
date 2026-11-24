# Laporan Pengujian 5 Transaksi Fiktif

- **Tanggal:** 24/11/2026, sekitar 18:30 WITA
- **Lingkungan:** build produksi Next.js 16.4.6 (`next start`, port 3123), project Supabase online `nqwgfceoqveucptyyklm`
- **Alat:** Playwright 1.65.1 (Chromium), `locale id-ID`, `timezoneId Asia/Makassar`. Ada 2 sesi browser terpisah: Admin (`SEED_ADMIN_*`) dan Sarpras (`SEED_SARPRAS_*`).
- **Skrip:** `tests/e2e/transaksi-fiktif.spec.ts`, dengan helper di `tests/e2e/support.ts`. Hasil mentah ada di `tests/e2e/hasil-run1.json` (run penuh) dan `tests/e2e/hasil-terakhir.json` (cek ulang pemeriksaan akhir).
- **Foto dummy:** `tests/fixtures/foto-dummy-1..5.jpg` (JPG 800×600). Diunggah lewat tombol "Pilih dari Galeri", jadi kompresi di browser ikut teruji.
- **Kondisi awal:** sebelum pengujian ada 2 peminjaman percobaan (PJM-0001/0002) dan WCM-001 berstatus `dalam_perbaikan`. Atas persetujuan pengguna, semuanya direset lewat script service role. Setelah reset, kondisi awal terverifikasi: 0 peminjaman dan 8 aset `tersedia/baik` (langkah 0).

## 1. Ringkasan

| | Jumlah |
|---|---|
| Langkah/pemeriksaan diuji | **33** (1 kondisi awal + 25 langkah transaksi + 7 pemeriksaan akhir) |
| ✅ Lulus | **33** (run 1: 31 lulus + A.6/A.7 lulus saat cek ulang) |
| ❌ Gagal (aplikasi) | **0** |

Pada run pertama, **A.6** dan **A.7** sempat tercatat gagal. Penyebabnya ada di **skrip uji**, bukan aplikasi. Skrip memeriksa teks "Akses ditolak" dengan `isVisible()` sebelum konten halaman yang di-stream (Suspense) selesai dimuat. Diagnosa read-only (`tests/e2e/diag/cek-403.spec.ts`, screenshot `tests/screenshots/diag-*.png`) membuktikan keempat URL memang menampilkan "Akses ditolak". Setelah skrip diperbaiki supaya menunggu konten, **hanya** pemeriksaan akhir yang dijalankan ulang (`-g "Pemeriksaan akhir"`, tanpa membuat transaksi baru), dan semuanya lulus. Kode aplikasi tidak diubah sama sekali.

## 2. Pemetaan kode

| Label | Kode aplikasi | Peminjam | Catatan |
|---|---|---|---|
| TRX-004 | **PJM-0001** | Ibu Sari Wulandari | dijalankan pertama sesuai urutan prompt |
| TRX-001 | **PJM-0002** | dr. Ayu Pratiwi | |
| TRX-002 | **PJM-0003** | Ns. Komang Ariani | |
| TRX-003 | **PJM-0004** | Ns. Komang Ariani | perpanjangan dari PJM-0003 |
| TRX-005 | **PJM-0005** | dr. Made Suardana | |

## 3. Hasil per langkah

| # | Yang diharapkan | Hasil sebenarnya | Status |
|---|---|---|---|
| 0 | 8 aset tersedia/baik, belum ada peminjaman | 0 peminjaman, 8 aset tersedia/baik | ✅ |
| **TRX-004** | | | |
| 1.1 | Laptop 1 + Webcam 1 → LPT-001, WCM-001 | Dipilih LPT-001, WCM-001 | ✅ |
| 1.2 | Ganti LPT-001: dropdown hanya LPT-002, LPT-003; pilih LPT-002 | Opsi tepat LPT-002, LPT-003; tabel menjadi LPT-002, WCM-001 | ✅ |
| 1.3 | Simpan → `diajukan`; LPT-002 & WCM-001 masih `tersedia` tapi terkunci; Sarpras dapat notifikasi | PJM-0001 `diajukan`. Kedua aset `tersedia` di tabel aset, tapi tidak muncul lagi di `aset_tersedia` (sisa laptop LPT-001, LPT-003; webcam WCM-002). Notifikasi Sarpras: "Peminjaman PJM-0001 (Ibu Sari Wulandari, R. Humas) menunggu pemasangan." dan ikon lonceng menunjukkan 1 belum dibaca | ✅ |
| 1.4 | Pemasangan Baik + 2 foto → `dipinjam`; aset `dipinjam`; 1 `pemasangan`, 2 `foto_pemasangan` | Sesuai | ✅ |
| 1.6 | Rusak tanpa catatan → ditolak | UI: "Lengkapi kondisi masuk (dan catatan untuk rusak/hilang): LPT-002." RPC langsung: "Catatan wajib diisi untuk unit yang rusak atau hilang." Tidak ada `pengembalian` tersimpan | ✅ |
| 1.5 | LPT-002 Rusak, WCM-001 Hilang, 3 foto → `selesai`; LPT-002 `dalam_perbaikan/rusak`; WCM-001 `hilang`; notifikasi Admin | Sesuai, 3 `foto_pengembalian`. Notifikasi Admin: "Pengembalian PJM-0001: LPT-002 rusak, WCM-001 hilang." | ✅ |
| **TRX-001** | | | |
| 2.1 | Laptop 1 + Proyektor 1 → LPT-001, PRJ-001 | Dipilih LPT-001, PRJ-001 (LPT-002 dalam perbaikan dilewati) | ✅ |
| 2.2 | Simpan → `diajukan` | PJM-0002 `diajukan` | ✅ |
| 2.3 | Pemasangan 2 foto → `dipinjam`; LPT-001 & PRJ-001 `dipinjam` | Sesuai | ✅ |
| 2.4 | Pengembalian Baik, 2 foto → `selesai`; LPT-001 & PRJ-001 `tersedia/baik` | Sesuai | ✅ |
| **TRX-002** | | | |
| 3.1 | Proyektor 1 + Webcam 1 → PRJ-001, WCM-002 | Dipilih PRJ-001, WCM-002 | ✅ |
| 3.2 | Simpan → `diajukan` | PJM-0003 `diajukan` (tanggal keluar diisi 3 jam lalu, lihat catatan di bagian 5) | ✅ |
| 3.3 | Pemasangan 2 foto → `dipinjam` | Sesuai | ✅ |
| 3.4 | Mundurkan rencana kembali 1 jam + jalankan fungsi cron → `terlambat` + notifikasi user `peminjaman.view` | `tandai_terlambat()` menandai 1 peminjaman; status `terlambat`. Notifikasi ke Admin & Sarpras: "Peminjaman PJM-0003 (Ns. Komang Ariani, Aula Diklat) terlambat. Rencana kembali 24/11/2026 17:31 WITA." | ✅ |
| 3.5 | Jalankan fungsi cron lagi → tidak ada notifikasi ganda | Run kedua menandai 0 peminjaman; notifikasi terlambat tetap 2 (1 per user) | ✅ |
| 3.6 | Dashboard Admin: PJM-0003 di daftar Terlambat, kartu Terlambat bertambah | Kartu Terlambat 0 → 1; PJM-0003 ada di tabel Terlambat | ✅ |
| **TRX-003** | | | |
| 4.1 | Perpanjang 3 hari, alasan "Pelatihan ditambah 2 sesi" → peminjaman baru, `perpanjangan_dari` = TRX-002, data & unit sama, kondisi keluar disalin | PJM-0004: `perpanjangan_dari` = PJM-0003, nama/divisi/kontak/ruangan sama, unit PRJ-001:baik, WCM-002:baik. Keperluan: "Pelatihan BHD perawat secara hybrid — Perpanjangan: Pelatihan ditambah 2 sesi" | ✅ |
| 4.2 | TRX-002 `selesai` tanpa `pengembalian`; TRX-003 `dipinjam` tanpa `pemasangan` | Sesuai (0 pengembalian, 0 pemasangan) | ✅ |
| 4.3 | PRJ-001 & WCM-002 tetap `dipinjam` | Sesuai | ✅ |
| 4.4 | Detail TRX-002 dan TRX-003 saling terhubung | PJM-0003 menampilkan "Diperpanjang menjadi PJM-0004"; PJM-0004 menampilkan "Perpanjangan dari PJM-0003" (keduanya link) | ✅ |
| **TRX-005** | | | |
| 5.1 | Proyektor 3 → ditolak semua, "hanya tersedia 2 unit Proyektor", tabel kosong | "Hanya tersedia 2 unit Proyektor."; tabel kosong | ✅ |
| 5.2 | Proyektor 2 + Laptop 1 → PRJ-002, PRJ-003, LPT-001 | Dipilih PRJ-002, PRJ-003, LPT-001 | ✅ |
| 5.3 | Simpan → `diajukan` | PJM-0005 `diajukan` | ✅ |
| 5.4 | Tab lain: Proyektor 1 → ditolak, tidak disimpan | "Hanya tersedia 0 unit Proyektor."; tab ditutup tanpa simpan | ✅ |
| 5.5 | Riwayat aset LPT-001 menampilkan TRX-001 dan TRX-005 | Riwayat LPT-001 berisi PJM-0002 (selesai) dan PJM-0005 (diajukan) | ✅ |
| **Pemeriksaan akhir** | | | |
| A.1 | Status peminjaman sesuai bagian 4 | TRX-004/001/002 selesai, TRX-003 dipinjam, TRX-005 diajukan | ✅ |
| A.2 | Status & kondisi aset sesuai bagian 4 | Sesuai (lihat bagian 6) | ✅ |
| A.3 | LPT-001, PRJ-002, PRJ-003 terkunci TRX-005 | Unit yang masih bisa dipilih hanya LPT-003 | ✅ |
| A.4 | Riwayat menampilkan 5 transaksi; cari nama & kode aset berjalan | 5 tampil; "Sari Wulandari" → PJM-0001; "PRJ-001" → PJM-0002, PJM-0003, PJM-0004 | ✅ |
| A.5 | Angka Dashboard Admin & Sarpras sesuai | Keduanya Diajukan 1 / Dipinjam 1 / Terlambat 0 / Aset Tersedia 1 (hanya LPT-003 yang benar-benar bisa dipinjam); PJM-0005 tampil di "Menunggu Pemasangan" Sarpras | ✅ |
| A.6 | Sarpras tidak bisa membuat, memperpanjang, membatalkan (UI & API) | UI: menu Peminjaman Baru tidak ada, `/peminjaman/baru` dan `/perpanjang` → "Akses ditolak", tombol Perpanjang/Batalkan tidak tampil. API: `buat_peminjaman`, `perpanjang_peminjaman`, `batalkan_peminjaman` → "Anda tidak punya izin untuk melakukan aksi ini."; `UPDATE peminjaman` langsung → "permission denied for table peminjaman"; PJM-0005 tetap `diajukan` | ✅ (run 1 ❌, false negatif skrip) |
| A.7 | Admin tidak bisa pemasangan & pengembalian (UI & API) | UI: tombol tidak tampil, `/pemasangan` dan `/pengembalian` → "Akses ditolak". API: `reservasi_id_kejadian`, `simpan_pemasangan`, `simpan_pengembalian` → "Anda tidak punya izin…"; upload Storage → "new row violates row-level security policy" | ✅ (run 1 ❌, false negatif skrip) |

Screenshot langkah-langkah kunci ada di `tests/screenshots/` (`1.1-…` s.d. `A.5-…`).

## 4. Detail kegagalan

Tidak ada kegagalan aplikasi. Catatan run pertama:

- **A.6 dan A.7 (run 1).** Hasil: "/peminjaman/baru tidak 403; /perpanjang tidak 403" dan "/pemasangan tidak 403; /pengembalian tidak 403". Screenshot `gagal-A.6.png` dan `gagal-A.7.png` diambil setelah skrip sudah pindah halaman, jadi tidak menunjukkan halaman 403-nya.
  - **Penyebab:** di skrip uji. `page.getByText("Akses ditolak").isVisible()` tidak menunggu, padahal halaman memakai Suspense/streaming (Cache Components), sehingga saat dicek yang tampil masih "Memuat...".
  - **Bukti:** `tests/e2e/diag/cek-403.spec.ts` mencatat `langsung: false | setelah networkidle: true | h1: Akses ditolak` untuk keempat URL.
  - **Perbaikan (skrip uji saja):** helper `tertolak()` menunggu heading "Akses ditolak" sampai 15 detik, dan pengecekan "tombol tidak ada" menunggu kartu Timeline atau heading halaman lebih dulu.

### Temuan non-blokir (usulan perbaikan, menunggu persetujuan)

| # | Temuan | Lokasi | Usulan |
|---|---|---|---|
| T1 | Halaman tanpa izin menampilkan "Akses ditolak" dengan **status HTTP 200**, bukan 403. Akses tetap tertolak (konten, server action, dan RLS), tapi kode statusnya tidak tepat. Penyebabnya, `forbidden()` dipanggil di dalam Suspense setelah header terkirim | `app/(app)/layout.tsx` (Suspense membungkus semua halaman), `lib/auth.ts` `requirePermission` | Periksa permission per rute di `proxy.ts` sebelum render (peta prefix rute → permission), atau pindahkan pengecekan ke luar boundary Suspense |
| T2 | Di lebar 1440 px, saat **Ganti** dibuka di form Peminjaman Baru, dropdown terpotong ("Pilih unit pengg…") dan tombol Batal/Hapus terdorong keluar sehingga tabel harus digeser (lihat `1.2-dropdown-ganti.png`) | `app/(app)/peminjaman/baru/peminjaman-form.tsx` (sel aksi tabel) | Tampilkan pemilih pengganti di baris terpisah di bawah unit, atau di modal; beri `min-width` pada kolom aksi |
| T3 | Input tanggal/jam memakai `datetime-local` bawaan browser, sehingga formatnya mengikuti locale OS/Chrome (`11/24/2026 06:31 PM`), bukan `dd/MM/yyyy HH:mm`. Tampilan data di tempat lain sudah sesuai format | `peminjaman-form.tsx`, `perpanjang-form.tsx` | Ganti dengan input tanggal + jam terpisah berformat 24 jam, atau komponen datepicker dengan format eksplisit |

## 5. Perintah SQL / akses langsung

Hanya dua jenis akses langsung yang diizinkan prompt yang dipakai. Keduanya dijalankan lewat Supabase client service role (PostgREST), setara dengan SQL berikut:

| Langkah | Perintah | Hasil |
|---|---|---|
| 3.4 | `update public.peminjaman set tgl_rencana_kembali = '2026-11-24T09:31:50.223Z' where id = 77; -- PJM-0003` (1 jam sebelum saat uji) | OK (1 baris) |
| 3.4 | `select public.tandai_terlambat();` | 1 peminjaman ditandai |
| 3.5 | `select public.tandai_terlambat();` | 0 peminjaman ditandai |

Catatan: PJM-0003 dibuat lewat UI dengan **tanggal keluar 3 jam sebelum saat uji**. Kalau tanggal keluar = sekarang, memundurkan rencana kembali ke 1 jam lalu akan melanggar constraint `peminjaman_tanggal_valid (tgl_rencana_kembali > tgl_peminjaman)`.

Di luar pengujian, sebelum mulai dilakukan reset kondisi awal yang sudah disetujui. Reset ini memakai script service role, bukan SQL: hapus PJM-0001/0002 percobaan beserta foto Storage-nya, lalu kembalikan WCM-001 ke `tersedia/baik`.

## 6. Status akhir database

### Peminjaman

| Label | Kode | Status sebenarnya | Diharapkan | Unit (keluar/masuk) | Foto pasang/kembali | |
|---|---|---|---|---|---|---|
| TRX-004 | PJM-0001 | `selesai` | `selesai` | LPT-002 baik/rusak, WCM-001 baik/hilang | 2 / 3 | ✅ |
| TRX-001 | PJM-0002 | `selesai` | `selesai` | LPT-001 baik/baik, PRJ-001 baik/baik | 2 / 2 | ✅ |
| TRX-002 | PJM-0003 | `selesai` | `selesai` (ditutup perpanjangan) | PRJ-001 baik/–, WCM-002 baik/– | 2 / – | ✅ |
| TRX-003 | PJM-0004 | `dipinjam` | `dipinjam` | PRJ-001 baik/–, WCM-002 baik/– (`perpanjangan_dari` = PJM-0003) | – / – | ✅ |
| TRX-005 | PJM-0005 | `diajukan` | `diajukan` | LPT-001, PRJ-002, PRJ-003 (belum dipasang) | – / – | ✅ |

### Aset

| Aset | Status sebenarnya | Kondisi sebenarnya | Diharapkan | |
|---|---|---|---|---|
| LPT-001 | `tersedia` | `baik` | `tersedia` / `baik` (terkunci TRX-005) | ✅ |
| LPT-002 | `dalam_perbaikan` | `rusak` | `dalam_perbaikan` / `rusak` | ✅ |
| LPT-003 | `tersedia` | `baik` | `tersedia` / `baik` | ✅ |
| PRJ-001 | `dipinjam` | `baik` | `dipinjam` / `baik` | ✅ |
| PRJ-002 | `tersedia` | `baik` | `tersedia` / `baik` (terkunci TRX-005) | ✅ |
| PRJ-003 | `tersedia` | `baik` | `tersedia` / `baik` (terkunci TRX-005) | ✅ |
| WCM-001 | `hilang` | `baik` | `hilang` / — | ✅ |
| WCM-002 | `dipinjam` | `baik` | `dipinjam` / `baik` | ✅ |

Notifikasi tersimpan: 8. Isinya 5 "menunggu pemasangan" untuk Sarpras, 1 pengembalian bermasalah untuk Admin, dan 2 terlambat (Admin & Sarpras).

## Cara menjalankan ulang

Kondisi awal harus 0 peminjaman dan 8 aset `tersedia/baik`. Lalu jalankan:

```bash
npm run build
npx playwright test tests/e2e/transaksi-fiktif.spec.ts
```
