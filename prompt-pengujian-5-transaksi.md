# Prompt: Pengujian 5 Transaksi Fiktif – Sistem Peminjaman Perangkat

Aplikasi Sistem Peminjaman Perangkat di repo ini sudah jadi. Tugasmu adalah **menguji aplikasi dengan 5 transaksi fiktif** di bawah, lalu melaporkan hasilnya. Tujuannya membuktikan bahwa aplikasi bisa:
- mencatat peminjaman dan pengembalian,
- menolak peminjaman ganda,
- menandai keterlambatan,
- menyimpan riwayat setelah perangkat tersedia kembali.

Baca seluruh prompt ini dulu, lalu periksa kode (skema, fungsi database, halaman) untuk memahami cara aplikasinya bekerja. Sebelum menjalankan pengujian, tunjukkan rencanamu ke saya.

---

## 1. Aturan pengujian

- **Jangan memperbaiki kode selama pengujian.** Kalau ada yang gagal, catat dulu: langkahnya, hasil yang diharapkan, hasil sebenarnya, dan dugaan penyebabnya (sebutkan file atau fungsi). Usulkan perbaikannya di laporan, dan tunggu persetujuan saya sebelum mengubah kode.
- **Uji lewat UI seperti pengguna asli**, memakai Playwright (pasang sebagai dev dependency kalau belum ada). Login sebagai **Admin** untuk langkah Admin dan sebagai **Sarpras** untuk langkah Sarpras. Akun diambil dari env `SEED_ADMIN_*` dan `SEED_SARPRAS_*`.
- **Cek database untuk memastikan hasilnya**, memakai Supabase client dengan service role key dari `.env.local`, setelah setiap langkah penting.
- **Akses SQL langsung hanya boleh untuk dua hal:**
  1. Memundurkan `tgl_rencana_kembali` supaya bisa menguji keterlambatan.
  2. Menjalankan fungsi yang dipakai job `pg_cron` secara manual, supaya tidak perlu menunggu 15 menit.

  Catat setiap perintah SQL yang kamu jalankan di laporan.
- **Foto:** buat beberapa gambar dummy (misalnya JPG polos 800×600) di folder `tests/fixtures/` untuk diunggah saat pemasangan dan pengembalian.
- Simpan skrip pengujian di `tests/e2e/transaksi-fiktif.spec.ts`, supaya bisa dijalankan ulang.

## 2. Kondisi awal

Pengujian ini **mengubah data di project Supabase**. Sebelum mulai:

1. Periksa isi database sekarang. Pengujian butuh kondisi awal berikut:
   - Kategori Laptop (`LPT`), Proyektor (`PRJ`), Webcam (`WCM`)
   - 8 aset: `LPT-001`–`LPT-003`, `PRJ-001`–`PRJ-003`, `WCM-001`–`WCM-002`, **semua berstatus `tersedia` dengan kondisi `baik`**
   - **Belum ada data peminjaman**
2. Kalau kondisinya belum seperti itu (misalnya sudah ada peminjaman lain, atau ada aset yang tidak tersedia), **berhenti dan tanya saya dulu**. Jelaskan apa yang berbeda dan data apa yang perlu dihapus atau direset. Jangan menghapus data apa pun tanpa persetujuan saya.

## 3. Transaksi yang diuji

Jalankan **berurutan sesuai daftar di bawah**. Urutan ini penting karena pemilihan unit otomatis bergantung pada transaksi sebelumnya.

Kode `TRX-00x` hanya label pengujian. Di aplikasi, kode peminjamannya akan berformat `PJM-xxxx`. Catat pemetaan keduanya di laporan.

Tanggal dan jam tidak perlu persis sama dengan contoh. Pakai waktu relatif terhadap saat pengujian, dan pastikan tanggal rencana kembali selalu setelah tanggal keluar.

---

### Langkah 1 – TRX-004: Ganti unit, kembali rusak dan hilang

**Data peminjam:** Ibu Sari Wulandari · Divisi: Bagian Humas · Kontak: 0812-0000-0004 · Ruangan: R. Humas · Keperluan: Rekaman video edukasi pasien

| # | Aktor | Aksi | Yang diharapkan |
|---|---|---|---|
| 1.1 | Admin | Buat peminjaman baru, tambah Laptop jumlah 1 dan Webcam jumlah 1 | Sistem memilih **LPT-001** dan **WCM-001** (kode terkecil) |
| 1.2 | Admin | Pakai aksi **Ganti** pada LPT-001 | Dropdown hanya berisi laptop yang tersedia (LPT-002, LPT-003). Pilih **LPT-002**. |
| 1.3 | Admin | Simpan | Status peminjaman **`diajukan`**. Status aset LPT-002 dan WCM-001 masih `tersedia`, tapi keduanya terkunci. Sarpras mendapat notifikasi. |
| 1.4 | Sarpras | Lakukan pemasangan: kondisi keluar Baik untuk kedua unit, unggah 2 foto | Status peminjaman **`dipinjam`**. LPT-002 dan WCM-001 jadi **`dipinjam`**. Tersimpan 1 baris `pemasangan` dan 2 baris `foto_pemasangan`. |
| 1.5 | Sarpras | Lakukan pengembalian: LPT-002 **Rusak** (catatan: "Engsel layar longgar"), WCM-001 **Hilang** (catatan: "Tidak ditemukan di ruangan"), unggah 3 foto | Status peminjaman **`selesai`**. LPT-002 jadi **`dalam_perbaikan`** dengan kondisi `rusak`. WCM-001 jadi **`hilang`**. Notifikasi untuk Admin muncul. |
| 1.6 | Sarpras | Coba simpan pengembalian dengan kondisi Rusak tapi catatan kosong (uji terpisah, sebelum 1.5 disimpan) | Ditolak karena catatan wajib diisi |

---

### Langkah 2 – TRX-001: Peminjaman normal

**Data peminjam:** dr. Ayu Pratiwi · Divisi: Instalasi Radiologi · Kontak: 0812-0000-0001 · Ruangan: R. Rapat Radiologi Lt. 2 · Keperluan: Presentasi kasus mingguan

| # | Aktor | Aksi | Yang diharapkan |
|---|---|---|---|
| 2.1 | Admin | Buat peminjaman, tambah Laptop jumlah 1 dan Proyektor jumlah 1 | Sistem memilih **LPT-001** (karena LPT-002 dalam perbaikan) dan **PRJ-001** |
| 2.2 | Admin | Simpan | Status **`diajukan`** |
| 2.3 | Sarpras | Pemasangan: kondisi keluar Baik untuk kedua unit, 2 foto | Status **`dipinjam`**. LPT-001 dan PRJ-001 jadi `dipinjam`. |
| 2.4 | Sarpras | Pengembalian: kedua unit Baik, 2 foto | Status **`selesai`**. LPT-001 dan PRJ-001 kembali **`tersedia`** dengan kondisi `baik`. |

---

### Langkah 3 – TRX-002: Terlambat

**Data peminjam:** Ns. Komang Ariani · Divisi: Bidang Diklat · Kontak: 0812-0000-0002 · Ruangan: Aula Diklat · Keperluan: Pelatihan BHD perawat secara hybrid

| # | Aktor | Aksi | Yang diharapkan |
|---|---|---|---|
| 3.1 | Admin | Buat peminjaman, tambah Proyektor jumlah 1 dan Webcam jumlah 1 | Sistem memilih **PRJ-001** (sudah tersedia lagi setelah TRX-001) dan **WCM-002** (WCM-001 hilang) |
| 3.2 | Admin | Simpan | Status **`diajukan`** |
| 3.3 | Sarpras | Pemasangan: kondisi keluar Baik untuk kedua unit, 2 foto | Status **`dipinjam`** |
| 3.4 | Penguji | Dengan SQL, ubah `tgl_rencana_kembali` peminjaman ini menjadi 1 jam sebelum sekarang. Lalu jalankan fungsi job pg_cron secara manual. | Status jadi **`terlambat`**. Notifikasi keterlambatan muncul untuk user yang punya `peminjaman.view`. |
| 3.5 | Penguji | Jalankan fungsi job pg_cron sekali lagi | **Tidak ada notifikasi ganda** untuk peminjaman yang sama |
| 3.6 | Admin | Buka Dashboard | Peminjaman ini muncul di daftar Terlambat, dan kartu Terlambat bertambah |

---

### Langkah 4 – TRX-003: Perpanjangan dari TRX-002

| # | Aktor | Aksi | Yang diharapkan |
|---|---|---|---|
| 4.1 | Admin | Buka detail TRX-002, pilih **Perpanjang**, isi tanggal rencana kembali baru (3 hari dari sekarang) dan alasan "Pelatihan ditambah 2 sesi" | Terbentuk **peminjaman baru** dengan `perpanjangan_dari` = TRX-002, data peminjam dan ruangan sama, berisi unit **PRJ-001** dan **WCM-002**, dengan kondisi keluar disalin |
| 4.2 | Penguji | Cek status kedua peminjaman | TRX-002 jadi **`selesai`** tanpa data `pengembalian`. TRX-003 langsung **`dipinjam`** tanpa data `pemasangan`. |
| 4.3 | Penguji | Cek status aset | PRJ-001 dan WCM-002 **tetap `dipinjam`** |
| 4.4 | Admin | Buka detail TRX-002 dan TRX-003 | Keduanya saling terhubung (link ke peminjaman sebelum dan sesudahnya) |

---

### Langkah 5 – TRX-005: Permintaan melebihi stok ditolak

**Data peminjam:** dr. Made Suardana · Divisi: Poli Anak · Kontak: 0812-0000-0005 · Ruangan: R. Seminar Poli Anak · Keperluan: Webinar penyuluhan orang tua pasien

| # | Aktor | Aksi | Yang diharapkan |
|---|---|---|---|
| 5.1 | Admin | Buat peminjaman, tambah Proyektor jumlah **3** | **Ditolak semuanya** dengan pesan bahwa hanya tersedia 2 unit Proyektor (PRJ-001 masih dipinjam di TRX-003). Tidak ada unit yang masuk tabel. |
| 5.2 | Admin | Tambah Proyektor jumlah **2** dan Laptop jumlah **1** | Sistem memilih **PRJ-002**, **PRJ-003**, dan **LPT-001**. LPT-001 bisa dipilih lagi karena sudah tersedia setelah TRX-001. |
| 5.3 | Admin | Simpan | Status **`diajukan`** |
| 5.4 | Admin | Di tab atau sesi lain, buat peminjaman baru dan tambah Proyektor jumlah 1 | **Ditolak**, karena PRJ-002 dan PRJ-003 terkunci oleh TRX-005 dan PRJ-001 sedang dipinjam. Batalkan form ini, jangan disimpan. |
| 5.5 | Admin | Buka riwayat aset LPT-001 | Riwayat TRX-001 **tetap tampil**, bersama TRX-005 |

---

## 4. Pemeriksaan akhir

### Status peminjaman

| Label | Status yang diharapkan |
|---|---|
| TRX-004 | `selesai` |
| TRX-001 | `selesai` |
| TRX-002 | `selesai` (ditutup karena perpanjangan) |
| TRX-003 | `dipinjam` |
| TRX-005 | `diajukan` |

### Status aset

| Aset | Status | Kondisi | Keterangan |
|---|---|---|---|
| LPT-001 | `tersedia` | `baik` | Terkunci oleh TRX-005 |
| LPT-002 | `dalam_perbaikan` | `rusak` | Dari TRX-004 |
| LPT-003 | `tersedia` | `baik` | Belum pernah dipinjam |
| PRJ-001 | `dipinjam` | `baik` | TRX-003 |
| PRJ-002 | `tersedia` | `baik` | Terkunci oleh TRX-005 |
| PRJ-003 | `tersedia` | `baik` | Terkunci oleh TRX-005 |
| WCM-001 | `hilang` | — | Dari TRX-004 |
| WCM-002 | `dipinjam` | `baik` | TRX-003 |

### Pemeriksaan tambahan
- Halaman **Riwayat Peminjaman** menampilkan kelima transaksi, dan pencarian berdasarkan nama peminjam serta kode aset berjalan.
- **Dashboard Admin dan Sarpras** menampilkan angka yang sesuai dengan data di atas.
- Akun **Sarpras** tidak bisa membuat peminjaman, memperpanjang, atau membatalkan, baik lewat UI maupun lewat pemanggilan server action atau API langsung.
- Akun **Admin** tidak bisa melakukan pemasangan dan pengembalian.

## 5. Laporan

Buat file `tests/laporan-pengujian.md` berisi:

1. **Ringkasan:** jumlah langkah lulus dan gagal.
2. **Pemetaan kode:** TRX-00x ke PJM-xxxx.
3. **Tabel hasil per langkah:** nomor langkah, yang diharapkan, hasil sebenarnya, dan status ✅ / ❌.
4. **Detail setiap kegagalan:** langkah untuk mereproduksi, screenshot (simpan di `tests/screenshots/`), dugaan penyebab beserta lokasi kodenya, dan usulan perbaikan.
5. **Daftar perintah SQL** yang dijalankan selama pengujian.
6. **Status akhir database:** tabel peminjaman dan aset yang sebenarnya, dibandingkan dengan tabel di bagian 4.

Setelah laporan selesai, tunjukkan ringkasannya ke saya dan tanyakan kegagalan mana yang perlu diperbaiki lebih dulu.
