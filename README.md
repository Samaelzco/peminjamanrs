# Sistem Peminjaman Perangkat — RSUP Prof. Ngoerah

Aplikasi web untuk memantau ketersediaan perangkat (laptop, proyektor, webcam), mencatat peminjaman, pemasangan,
pengembalian, perpanjangan, menandai keterlambatan otomatis, dan menyimpan riwayat.

**Stack:** Next.js 16 (App Router, TypeScript strict, Cache Components) · Supabase (Postgres, Auth, Storage, pg_cron)
· `@supabase/ssr` · Tailwind CSS 4 + `flowbite-react` · `zod` · Supabase CLI.

## Menjalankan

```bash
npm install
cp .env.example .env.local      # isi semua nilai (lihat bawah)
npx supabase login
npx supabase link --project-ref <project-ref>
npm run db:push                 # kirim semua migration ke project online
npm run db:types                # generate lib/database.types.ts
npm run seed:admin              # akun Administrasi dari SEED_ADMIN_*
npm run seed:demo               # kategori, 8 aset, akun Sarpras dari SEED_SARPRAS_*
npm run dev
```

| Variabel | Keterangan |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | URL dan publishable key project |
| `SUPABASE_SERVICE_ROLE_KEY` | **Hanya server** (`lib/supabase/admin.ts` memakai `server-only`) |
| `SUPABASE_DB_PASSWORD` | Dipakai Supabase CLI (`db push`, `gen types`) |
| `SEED_ADMIN_*`, `SEED_SARPRAS_*` | Akun awal untuk seeder |

Pengaturan di dashboard Supabase (bukan skema):

- Authentication → Sign In / Providers → **Allow new users to sign up = off** (pendaftaran mandiri dimatikan).
- Disarankan: aktifkan *Leaked password protection*.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run lint` / `npm run typecheck` / `npm run build` | Pemeriksaan kode |
| `npm run db:push` | Kirim migration baru ke project online (`supabase db push --remote`) |
| `npm run db:types` | Generate tipe TypeScript dari skema |
| `npm run seed:admin` / `npm run seed:demo` | Seeder (aman dijalankan ulang) |
| `npm run test:db` | Uji lapis database: RBAC, data master, peminjaman, pemasangan/pengembalian, perpanjangan/terlambat, koreksi manual |
| `npm run test:web` | Uji akses halaman lewat HTTP (jalankan dulu `npm run build && npx next start -p 3123`) |

Ukur waktu muat halaman (server produksi harus berjalan di port 3123): `npx tsx --env-file=.env.local scripts/tests/bench.ts`.

Uji membuat akun sementara dan data transaksi, lalu membersihkannya kembali (aset demo dikembalikan ke
`tersedia/baik`). Uji pg_cron sungguhan (menunggu ≤2 menit): `npx tsx --env-file=.env.local scripts/tests/cron-nyata.test.ts`.

## Arsitektur singkat

- **RBAC dua lapis.** Next.js: menu, halaman (`requirePermission` → 403), tombol, dan setiap server action
  (`authorize`). Database: RLS di semua tabel memakai `has_permission()` (`security definer`, `stable`); user
  `non_aktif` tidak punya permission apa pun. `proxy.ts` (pengganti middleware di Next 16) mengeluarkan user non-aktif.
- **Semua perubahan lintas tabel lewat RPC** dalam satu transaksi: `buat_peminjaman`, `batalkan_peminjaman`,
  `ganti_unit_pemasangan`, `simpan_pemasangan`, `simpan_pengembalian`, `perpanjang_peminjaman`. Client hanya punya
  hak `SELECT` pada tabel transaksi.
- **Penolakan peminjaman ganda:** `buat_peminjaman` mengunci baris aset (`FOR UPDATE`) lalu mengecek ulang
  ketersediaan (aturan 6.1) dan menyebut unit yang bentrok.
- **Transisi status** divalidasi trigger `guard_status_peminjaman` (6.9); setiap perubahan tercatat di
  `log_peminjaman` untuk timeline. Status aset ke/dari `dipinjam` hanya bisa diubah oleh alur peminjaman.
- **Foto:** bucket privat `foto-peminjaman`. ID pemasangan/pengembalian dipesan dulu
  (`reservasi_id_kejadian`), foto dikompres di browser (≤1600 px, JPEG) dan diunggah ke
  `pemasangan/{id}/{uuid}.jpg`, lalu RPC memverifikasi file benar-benar ada sebelum menyimpan. Ditampilkan dengan
  signed URL.
- **pg_cron** `tandai-peminjaman-terlambat` setiap menit → `tandai_terlambat()`; notifikasi
  `jenis='terlambat'` dijaga unique index sehingga tidak ganda.
- **Terlambat saat dicatat:** bila rencana kembali sudah lewat ketika peminjaman dibuat, `buat_peminjaman` langsung
  memberi status `terlambat` (bukan `diajukan`). Unitnya belum dipasang, jadi pemasangan & pembatalan tetap bisa
  dilakukan; pengembalian & perpanjangan baru bisa setelah dipasang (`sudah_terpasang()`).
- **Koreksi riwayat** (`/peminjaman/{id}/ubah`, permission `peminjaman.update`, role Administrasi): RPC
  `ubah_peminjaman` memperbaiki data peminjam, jadwal, dan status. Status yang boleh dipilih: belum dipasang →
  diajukan/terlambat/dibatalkan; sudah dipasang → dipinjam/terlambat/selesai; sudah dikembalikan atau diperpanjang →
  dikunci. Terlambat hanya bila rencana kembali sudah lewat (diajukan/dipinjam sebaliknya). Menutup manual melepas
  unit (kembali `tersedia`), mengaktifkan kembali memeriksa unit masih bebas. Setiap perubahan tercatat di timeline.
- **Sesi dibaca sekali per request:** `proxy.ts` membaca profil + permission lalu meneruskannya lewat header request
  internal `x-peminjaman-akses` (header kiriman klien selalu dibuang). `getCurrentUser()` memakainya bila `id`-nya cocok
  dengan JWT, sehingga layout/halaman/server action tidak mengulang query. Notifikasi dimuat dalam `Suspense` terpisah.
- **Unduh rekap (Excel)** di halaman Riwayat (`/riwayat/ekspor`, permission `laporan.export`, hanya Administrasi): memakai filter yang
  sedang aktif (periode tanggal keluar, status, pencarian; tombol cepat Bulan ini / Bulan lalu). Isi: sheet
  Ringkasan (jumlah per status, persentase & durasi terlambat, per divisi, per kategori), Riwayat, Keterlambatan
  (urut durasi terlambat terlama), dan Per Unit (berapa kali dipinjam, terlambat, kembali rusak/hilang). Keterlambatan
  dihitung dari rencana kembali sampai dikembalikan/ditutup, atau sampai saat unduh bila belum kembali. Waktu dalam WITA.
- **Waktu** disimpan `timestamptz`, ditampilkan WITA (`Asia/Makassar`) dengan format `dd/MM/yyyy HH:mm`.

### Tambahan di luar spesifikasi (disepakati)

- Tabel `penggantian_unit` (alasan ganti unit saat pemasangan) dan `log_peminjaman` (timeline).
- Kolom `notifikasi.jenis` untuk mencegah notifikasi terlambat ganda.
- Kategori & kode aset tidak dapat diubah setelah aset dibuat; `kode_prefix` terkunci bila kategori punya aset.
- Admin tidak dapat menonaktifkan akun sendiri atau mengubah role sendiri.
- Alasan perpanjangan ditambahkan ke keperluan: `"<keperluan lama>\n— Perpanjangan: <alasan>"`.

### Validasi input

Aturan dan batasnya ada di satu tempat, `lib/validation.ts` (`BATAS`), dan dipakai di tiga lapis:

1. **Form (client):** `maxLength`, sanitasi saat mengetik (nomor kontak dan jumlah hanya angka, kode prefix hanya huruf kapital), dan penghitung karakter.
2. **Server action (zod):** pesan error per kolom. Contoh aturan: nama hanya huruf; kontak 10–15 angka diawali 0/62; lama pinjam maks 30 hari; tanggal keluar maks 7 hari ke belakang; password 8–72 karakter dengan huruf dan angka.
3. **Database:** CHECK constraint untuk panjang teks dan format kontak (migration `20261125000100`), sehingga panggilan API/RPC langsung pun ditolak.

Input tanggal memakai `components/datetime-field.tsx` dengan format tetap `dd/mm/yyyy jj:mm` (24 jam, WITA), tidak bergantung locale browser.
Halaman tanpa izin dicegat di `proxy.ts` (`lib/route-permissions.ts`) dan dijawab dengan status **HTTP 403**.

Uji: `npx playwright test tests/e2e/validasi.spec.ts` (tidak menyimpan data).

### Halaman /debug (reset data demo)

Aktif hanya bila `ENABLE_DEBUG_PAGE=true`; selain itu `/debug` menjadi 404 dan aksinya ditolak. Akses memerlukan permission
`debug.reset` (diberikan ke role Administrasi), dan tombol reset baru aktif setelah mengetik `RESET`.
Reset menjalankan `reset_data_demo()` (hanya `service_role`, satu transaksi): semua transaksi, log, dan notifikasi dikosongkan,
4 kategori demo (Laptop, Proyektor, Webcam, Conf-Cam) dan 8 aset demo (TI-LPT-001 dst.) kembali `tersedia/baik`, aset/kategori lain dihapus. Setelah itu foto di Storage dihapus.
Akun, role, dan permission tidak berubah. **Jangan aktifkan di produksi.**

Uji: `npx playwright test tests/e2e/debug.spec.ts` (reset sungguhan hanya dengan `RUN_RESET=1`).
