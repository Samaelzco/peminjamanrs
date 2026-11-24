# Prompt: Sistem Peminjaman Perangkat – RSUP Prof. Ngoerah

Kamu akan membangun aplikasi web **Sistem Peminjaman Perangkat** untuk RSUP Prof. Ngoerah. Unit rumah sakit meminjam perangkat seperti laptop, proyektor, dan webcam. Aplikasi ini membantu petugas memantau ketersediaan perangkat, mencatat peminjaman dan pengembalian, menandai keterlambatan, dan menyimpan riwayat.

Baca seluruh prompt ini dulu. Sebelum menulis kode, buat rencana kerja per fase dan tunjukkan ke saya. Kalau ada yang ambigu atau bertentangan, tanyakan dulu, jangan menebak.

---

## 1. Tech stack

- **Next.js** versi terbaru, App Router, TypeScript (strict)
- **Supabase**: Postgres, Auth (email + password), Storage, `pg_cron`
- `@supabase/ssr` untuk client server dan browser
- **Tailwind CSS + `flowbite-react`** untuk semua komponen UI
- `zod` untuk validasi input di server action
- **Supabase CLI** untuk migration

## 2. Aturan umum

- **Bahasa:** semua teks UI dalam Bahasa Indonesia. Nama tabel dan kolom juga Bahasa Indonesia, `snake_case` (contoh: `peminjaman`, `detail_peminjaman`, `tgl_rencana_kembali`). Nama variabel dan fungsi di kode boleh bahasa Inggris.
- **Zona waktu:** lokasi rumah sakit di WITA (`Asia/Makassar`, UTC+8). Simpan semua waktu sebagai `timestamptz`, dan tampilkan di UI dalam WITA dengan format `dd/MM/yyyy HH:mm`. Jadwal `pg_cron` berjalan dalam UTC.
- **Database:** langsung ke project Supabase online milik saya, tapi **setiap perubahan skema wajib dibuat sebagai file migration** di `supabase/migrations/`, lalu dikirim dengan `supabase link` + `supabase db push`. Jangan mengubah skema langsung dari dashboard atau SQL ad-hoc. Minta konfirmasi saya sebelum menjalankan perintah yang menghapus atau mereset data di project online.
- **Secret:** simpan di `.env.local` (jangan di-commit). Buat `.env.example` berisi nama variabel tanpa nilai. `SUPABASE_SERVICE_ROLE_KEY` hanya boleh dipakai di kode server, tidak boleh sampai ke browser.
- Setelah migration, generate tipe TypeScript dari skema Supabase dan pakai di seluruh kode.

## 3. RBAC (meniru Laravel Spatie)

### Konsep
- **Permission** didefinisikan di migration/seed dan **tidak bisa dibuat, diubah, atau dihapus dari aplikasi**.
- **Role** bisa dibuat, diubah, dan dihapus dari aplikasi. Permission diatur per role lewat **toggle**, dikelompokkan per modul.
- Satu user punya **satu role**.
- Hak akses dicek di **dua lapis**:
  1. **Next.js:** menu, halaman, tombol, dan setiap server action dicek dengan helper `can(permission)`.
  2. **Database:** RLS aktif di semua tabel, memakai fungsi SQL `has_permission(nama_permission text)` (`security definer`, `stable`) yang membaca role user yang sedang login.

### Tabel
- `roles`: `id`, `nama` (unique), `deskripsi`, timestamps
- `permissions`: `id`, `nama` (unique, contoh `peminjaman.create`), `modul`, `deskripsi`
- `role_permissions`: `role_id`, `permission_id` (primary key gabungan)

### Daftar permission (seed)

| Modul | Permission |
|---|---|
| Dashboard | `dashboard.view` |
| Akun | `user.view`, `user.create`, `user.update`, `user.toggle-status` |
| Role | `role.view`, `role.manage` |
| Kategori | `kategori.view`, `kategori.create`, `kategori.update`, `kategori.delete` |
| Aset | `aset.view`, `aset.create`, `aset.update`, `aset.delete` |
| Peminjaman | `peminjaman.view`, `peminjaman.create`, `peminjaman.cancel`, `peminjaman.extend` |
| Pemasangan | `pemasangan.create` |
| Pengembalian | `pengembalian.create` |
| Riwayat | `riwayat.view` |

### Role awal (seed)
- **Administrasi:** `dashboard.view`, semua `user.*`, semua `role.*`, `kategori.view`, `aset.view`, semua `peminjaman.*`, `riwayat.view`
- **Sarana dan Prasarana:** `dashboard.view`, semua `kategori.*`, semua `aset.*`, `peminjaman.view`, `pemasangan.create`, `pengembalian.create`, `riwayat.view`

### Aturan pengaman
- User tidak boleh mematikan `role.manage` pada **role miliknya sendiri**, supaya tidak ada yang terkunci dari halaman Role & Permission.
- Role yang masih dipakai user tidak boleh dihapus.

## 4. Akun dan autentikasi

- Login memakai Supabase Auth (email + password). **Pendaftaran mandiri dimatikan.** Akun hanya dibuat Admin dari halaman Kelola Akun, lewat server action yang memakai service role (`auth.admin.createUser`).
- Password disimpan oleh Supabase Auth, bukan di tabel aplikasi.
- Tabel `staff_it` adalah profil user: `id` (uuid, PK, FK ke `auth.users.id`), `nama`, `email` (unique), `role_id` (FK), `status` (`aktif` / `non_aktif`), timestamps.
- User berstatus `non_aktif` tidak bisa memakai aplikasi. Cek di middleware Next.js **dan** di fungsi RLS: user non-aktif dianggap tidak punya permission apa pun.
- **Seeder admin:** buat script `scripts/seed-admin.ts` (dijalankan dengan `npm run seed:admin`) yang membuat satu akun berrole Administrasi dari env `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAMA`. Script harus aman dijalankan ulang: kalau email sudah ada, lewati.

## 5. Model data

Gunakan tipe `enum` Postgres untuk kolom status dan kondisi.

- **`kategori`**: `id`, `nama` (unique), `kode_prefix` (unique, contoh `LPT`, `PRJ`, `WCM`), timestamps
- **`aset`**: `id`, `kode_aset` (unique), `nama_aset`, `kategori_id` (FK), `deskripsi` (nullable), `kondisi` (`baik` / `rusak`), `status` (`tersedia` / `dipinjam` / `dalam_perbaikan` / `hilang`), timestamps
  - `kode_aset` dibuat otomatis dari `kode_prefix` kategori + nomor urut 3 digit, contoh `LPT-001`.
- **`peminjaman`**:
  - `id`, `kode_peminjaman` (unique, otomatis, contoh `PJM-0001`)
  - `dicatat_oleh` (FK `staff_it`), `perpanjangan_dari` (FK ke `peminjaman`, nullable)
  - `nama_peminjam`, `divisi_peminjam`, `kontak_peminjam`, `ruangan`, `keperluan`
  - `tgl_peminjaman` (timestamptz), `tgl_rencana_kembali` (timestamptz)
  - `status` (`diajukan` / `dipinjam` / `terlambat` / `dibatalkan` / `selesai`), timestamps
- **`detail_peminjaman`**: `id`, `peminjaman_id` (FK), `aset_id` (FK), `kondisi_keluar` (`baik` / `rusak`, nullable sampai dipasang), `kondisi_masuk` (`baik` / `rusak` / `hilang`, nullable sampai dikembalikan), `catatan` (nullable)
- **`pemasangan`**: `id`, `peminjaman_id` (FK, **unique**), `staff_id` (FK `staff_it`, petugas Sarpras), `tgl_pemasangan` (timestamptz), `created_at`
- **`pengembalian`**: `id`, `peminjaman_id` (FK, **unique**), `staff_id` (FK `staff_it`), `tgl_kembali` (timestamptz), `created_at`
- **`foto_pemasangan`**: `id`, `pemasangan_id` (FK), `path_foto`, `created_at`
- **`foto_pengembalian`**: `id`, `pengembalian_id` (FK), `path_foto`, `created_at`
- **`notifikasi`**: `id`, `user_id` (FK `staff_it`), `peminjaman_id` (FK, nullable), `pesan`, `sudah_dibaca` (boolean, default false), `created_at`

Catatan:
- Foto dicatat **per kejadian** (pemasangan / pengembalian), bukan per unit, dan boleh lebih dari satu.
- Kondisi dicatat **per unit** di `detail_peminjaman`.
- Barang tidak boleh dikembalikan bertahap: satu peminjaman punya paling banyak satu pemasangan dan satu pengembalian.

## 6. Aturan bisnis

Semua perubahan yang menyentuh lebih dari satu tabel (buat peminjaman, pemasangan, pengembalian, perpanjangan, pembatalan) harus dibuat sebagai **fungsi Postgres (RPC) dalam satu transaksi**, supaya tidak ada data setengah jadi.

### 6.1 Unit "tersedia untuk dipilih"
Aset dianggap tersedia kalau `status = 'tersedia'` **dan** tidak ada di `detail_peminjaman` milik peminjaman berstatus `diajukan`, `dipinjam`, atau `terlambat`.

### 6.2 Membuat peminjaman (Admin, `peminjaman.create`)
1. Admin mengisi data peminjam (nama, nomor kontak, divisi, ruangan, keperluan) dan jadwal (tanggal + jam keluar, tanggal + jam rencana kembali). Rencana kembali harus setelah tanggal keluar.
2. Admin **tidak memilih unit**. Admin memilih **kategori** dan mengisi **jumlah**, lalu klik **+ Tambah Unit**. Sistem otomatis mengambil unit yang tersedia dengan **kode terkecil**, lalu menampilkan detailnya di tabel: kode unit, nama barang, kategori, ketersediaan.
3. Kalau jumlah melebihi unit yang tersedia, **tolak semuanya** dengan pesan, contoh: "Hanya tersedia 2 unit Proyektor." Tidak ada unit yang ditambahkan.
4. Satu peminjaman bisa berisi beberapa kategori (tambah berkali-kali).
5. Setiap baris punya aksi **Hapus** dan **Ganti**. Ganti membuka dropdown berisi unit lain di kategori yang sama yang tersedia (aturan 6.1).
6. Saat **Simpan**, fungsi database mengunci baris aset yang dipilih (`FOR UPDATE`) dan **mengecek ulang** ketersediaannya. Kalau ada unit yang sudah diambil peminjaman lain (misalnya dua admin menyimpan bersamaan), tolak dengan pesan yang menyebut unit mana yang bentrok. Ini mekanisme **penolakan peminjaman ganda**.
7. Peminjaman tersimpan dengan status **`diajukan`**. Status aset **belum** berubah, tapi unitnya sudah terkunci menurut aturan 6.1.
8. Buat notifikasi untuk semua user aktif yang punya `pemasangan.create`.

### 6.3 Pemasangan (Sarpras, `pemasangan.create`)
- Hanya untuk peminjaman berstatus `diajukan`.
- Sarpras mengisi **kondisi keluar per unit** (`baik` / `rusak`) dan mengunggah **minimal 1 foto** (boleh banyak).
- Kalau sebuah unit gagal dites, Sarpras bisa **mengganti** unit itu dengan unit lain yang tersedia di kategori yang sama, disertai alasan. Unit lama jadi `dalam_perbaikan`.
- Saat disimpan: buat baris `pemasangan`, ubah status peminjaman jadi **`dipinjam`**, dan ubah status setiap aset jadi **`dipinjam`**.

### 6.4 Status Terlambat otomatis (`pg_cron`)
- Job `pg_cron` berjalan **setiap 15 menit**. Peminjaman berstatus `dipinjam` dengan `tgl_rencana_kembali < now()` diubah jadi **`terlambat`**.
- Untuk setiap peminjaman yang baru jadi terlambat, buat notifikasi ke semua user aktif yang punya `peminjaman.view`. Jangan membuat notifikasi ganda untuk peminjaman yang sama.

### 6.5 Pengembalian (Sarpras, `pengembalian.create`)
- Hanya untuk peminjaman berstatus `dipinjam` atau `terlambat`. **Semua unit dikembalikan sekaligus.**
- Sarpras mengisi **kondisi masuk per unit** (`baik` / `rusak` / `hilang`). **Catatan wajib** kalau kondisinya `rusak` atau `hilang`. Minimal 1 foto.
- Saat disimpan:
  - Buat baris `pengembalian`, dan status peminjaman jadi **`selesai`**, **termasuk kalau ada unit yang hilang**.
  - Status aset mengikuti kondisi masuknya:
    - `baik` → status `tersedia`, kondisi `baik`
    - `rusak` → status `dalam_perbaikan`, kondisi `rusak`
    - `hilang` → status `hilang`
  - Kalau ada unit rusak atau hilang, buat notifikasi untuk user yang punya `peminjaman.view`.

### 6.6 Perpanjangan (Admin, `peminjaman.extend`)
- Hanya untuk peminjaman berstatus `dipinjam` atau `terlambat`.
- Perpanjangan **bukan** mengedit tanggal kembali. Perpanjangan **membuat peminjaman baru**:
  - `perpanjangan_dari` diisi peminjaman lama.
  - Data peminjam, ruangan, dan unit sama dengan peminjaman lama. `kondisi_keluar` disalin.
  - `tgl_peminjaman` = waktu perpanjangan, `tgl_rencana_kembali` = tanggal baru yang diisi Admin, beserta alasan perpanjangan (masuk ke `keperluan`).
  - Status langsung **`dipinjam`**, **tanpa pemasangan ulang**.
- Peminjaman lama ditutup jadi **`selesai`** tanpa data pengembalian. Status aset tetap `dipinjam`.
- Pengembalian nantinya dilakukan pada peminjaman yang baru.

### 6.7 Pembatalan (Admin, `peminjaman.cancel`)
- Hanya untuk status `diajukan`. Status jadi `dibatalkan`, dan unitnya otomatis bebas lagi menurut aturan 6.1.

### 6.8 Data master
- Kategori yang masih punya aset tidak bisa dihapus.
- Aset yang punya riwayat peminjaman tidak bisa dihapus.
- Sarpras bisa mengubah status aset secara manual (misalnya `dalam_perbaikan` → `tersedia` setelah diperbaiki), tapi **tidak boleh** mengubah ke atau dari `dipinjam`, karena status itu hanya diatur oleh alur peminjaman.

### 6.9 Transisi status peminjaman yang sah
- `diajukan` → `dipinjam` (pemasangan) atau `dibatalkan`
- `dipinjam` → `terlambat` (otomatis) atau `selesai` (pengembalian / perpanjangan)
- `terlambat` → `selesai` (pengembalian / perpanjangan)

Tolak transisi selain itu di fungsi database.

## 7. Storage foto

- Bucket **privat** `foto-peminjaman`, dengan path `pemasangan/{pemasangan_id}/{uuid}.jpg` dan `pengembalian/{pengembalian_id}/{uuid}.jpg`.
- Tampilkan foto dengan signed URL. Atur policy Storage sesuai permission.
- Di browser, kompres gambar sebelum diunggah (lebar maksimal sekitar 1600 px). Input file harus bisa membuka kamera di HP (`accept="image/*"` dan `capture`), karena Sarpras mengunggah dari lokasi.

## 8. Halaman

Menu sidebar muncul sesuai permission user. Semua halaman harus responsif, tapi prioritasnya desktop.

1. **Login**
2. **Dashboard:** kartu ringkasan (Diajukan, Dipinjam, Terlambat, Aset Tersedia), tabel peminjaman yang perlu ditindaklanjuti sesuai permission (Admin: berjalan dan terlambat; Sarpras: menunggu pemasangan, terlambat, sedang dipinjam), dan ikon notifikasi dengan jumlah yang belum dibaca.
3. **Peminjaman Baru:** sesuai aturan 6.2 (kategori + jumlah, tabel unit dengan aksi Ganti dan Hapus).
4. **Detail Peminjaman:** info peminjam, daftar unit dengan kondisi keluar dan masuk, foto pemasangan dan pengembalian, rantai perpanjangan (link ke peminjaman sebelum dan sesudahnya), timeline kejadian, serta tombol aksi sesuai status dan permission (Pemasangan, Pengembalian, Perpanjang, Batalkan).
5. **Form Pemasangan** dan **Form Pengembalian:** sesuai aturan 6.3 dan 6.5.
6. **Riwayat Peminjaman:** pencarian (kode, nama peminjam, divisi, kode aset), filter status dan rentang tanggal, serta pagination.
7. **Data Aset:** CRUD, filter kategori, status, dan kondisi, serta riwayat peminjaman per aset.
8. **Kategori:** CRUD.
9. **Kelola Akun:** daftar user, tambah akun (nama, email, password, role), edit, aktif/non-aktifkan.
10. **Role & Permission:** daftar role (tambah, edit, hapus), dan halaman atur permission per role berisi **toggle yang dikelompokkan per modul**. Tidak ada tombol tambah permission.

## 9. Seed data demo

Buat `npm run seed:demo` (terpisah dari seed admin, aman dijalankan ulang) yang mengisi:
- Kategori: Laptop (`LPT`), Proyektor (`PRJ`), Webcam (`WCM`)
- 8 aset: `LPT-001`–`LPT-003`, `PRJ-001`–`PRJ-003`, `WCM-001`–`WCM-002`, semua berstatus `tersedia` dengan kondisi `baik`
- Satu akun Sarpras demo dari env `SEED_SARPRAS_EMAIL`, `SEED_SARPRAS_PASSWORD`, `SEED_SARPRAS_NAMA`

Transaksi tidak di-seed. Transaksi akan dimasukkan lewat aplikasi saat demo.

## 10. Urutan pengerjaan

Kerjakan per fase. Di akhir setiap fase, jalankan lint, typecheck, dan build, lalu beri ringkasan singkat sebelum lanjut.

1. **Setup:** Next.js, Tailwind, flowbite-react, Supabase client, `supabase link`, struktur folder
2. **Auth + RBAC:** migration tabel akun dan RBAC, fungsi `has_permission`, RLS, middleware, helper `can()`, seeder admin, halaman Login, Kelola Akun, Role & Permission
3. **Data master:** Kategori, Aset, seed demo
4. **Peminjaman:** fungsi buat peminjaman (6.2), halaman Peminjaman Baru, Detail Peminjaman, pembatalan
5. **Pemasangan dan Pengembalian:** fungsi database, Storage, upload foto, form
6. **Perpanjangan, pg_cron Terlambat, notifikasi, Dashboard**
7. **Riwayat** dan perapian UI

## 11. Skenario yang harus lolos

Uji skenario berikut (secara manual atau otomatis) dan laporkan hasilnya:

1. Admin meminjam 1 laptop dan 1 proyektor. Sistem memilih `LPT-001` dan `PRJ-001` (kode terkecil). Status peminjaman jadi `diajukan`.
2. Admin meminta 4 proyektor padahal hanya 3 yang tersedia. Semuanya ditolak dengan pesan jumlah tersedia.
3. Unit yang ada di peminjaman `diajukan` tidak muncul sebagai pilihan untuk peminjaman lain.
4. Dua penyimpanan bersamaan yang memakai unit sama: hanya satu yang berhasil.
5. Sarpras memasang dengan 2 foto. Status peminjaman dan aset jadi `dipinjam`.
6. Tanggal rencana kembali lewat. Dalam 15 menit, status jadi `terlambat` dan notifikasi muncul.
7. Admin memperpanjang peminjaman yang terlambat. Peminjaman lama jadi `selesai`, peminjaman baru langsung `dipinjam` dengan `perpanjangan_dari` terisi.
8. Pengembalian dengan 1 unit baik, 1 rusak, 1 hilang. Peminjaman jadi `selesai`, dan aset masing-masing jadi `tersedia`, `dalam_perbaikan`, dan `hilang`.
9. Aset yang sudah kembali `tersedia` bisa dipinjam lagi, dan riwayat lamanya tetap tampil.
10. User Sarpras tidak bisa membuka halaman Kelola Akun, baik dari menu maupun lewat URL atau API langsung.
11. Admin tidak bisa mematikan `role.manage` pada role-nya sendiri.
12. User `non_aktif` tidak bisa login atau memakai aplikasi.
