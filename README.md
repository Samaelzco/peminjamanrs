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
| `npm run test:db` | Uji lapis database: RBAC, data master, peminjaman, pemasangan/pengembalian, perpanjangan/terlambat |
| `npm run test:web` | Uji akses halaman lewat HTTP (jalankan dulu `npm run build && npx next start -p 3123`) |

Uji membuat akun sementara dan data transaksi, lalu membersihkannya kembali (aset demo dikembalikan ke
`tersedia/baik`). Uji pg_cron sungguhan (menunggu ≤15 menit): `npx tsx --env-file=.env.local scripts/tests/cron-nyata.test.ts`.

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
- **pg_cron** `tandai-peminjaman-terlambat` setiap 15 menit (UTC) → `tandai_terlambat()`; notifikasi
  `jenis='terlambat'` dijaga unique index sehingga tidak ganda.
- **Waktu** disimpan `timestamptz`, ditampilkan WITA (`Asia/Makassar`) dengan format `dd/MM/yyyy HH:mm`.

### Tambahan di luar spesifikasi (disepakati)

- Tabel `penggantian_unit` (alasan ganti unit saat pemasangan) dan `log_peminjaman` (timeline).
- Kolom `notifikasi.jenis` untuk mencegah notifikasi terlambat ganda.
- Kategori & kode aset tidak dapat diubah setelah aset dibuat; `kode_prefix` terkunci bila kategori punya aset.
- Admin tidak dapat menonaktifkan akun sendiri atau mengubah role sendiri.
- Alasan perpanjangan ditambahkan ke keperluan: `"<keperluan lama>\n— Perpanjangan: <alasan>"`.
