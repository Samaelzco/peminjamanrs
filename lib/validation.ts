// Aturan validasi input bersama (dipakai client untuk maxLength/sanitasi, dan server lewat zod).
// Aman diimpor dari client.
import { z } from "zod";

export const BATAS = {
  namaOrang: 100,
  divisi: 100,
  ruangan: 100,
  keperluan: 500,
  kontakMin: 10,
  kontakMax: 15,
  catatan: 500,
  alasan: 300,
  namaAset: 100,
  deskripsiAset: 500,
  namaKategori: 50,
  namaRole: 50,
  deskripsiRole: 255,
  email: 254,
  passwordMin: 8,
  passwordMax: 72,
  jumlahUnitMax: 50,
  cari: 60,
  /** Lama peminjaman maksimal (hari). */
  durasiMaksHari: 30,
  /** Tanggal keluar paling lama sekian hari ke belakang (untuk pencatatan susulan). */
  mundurMaksHari: 7,
} as const;

// ---------------------------------------------------------------------
// Sanitasi saat mengetik (client)
// ---------------------------------------------------------------------
/** Hanya angka (untuk nomor kontak & jumlah). */
export const hanyaAngka = (v: string) => v.replace(/\D+/g, "");
/** Hanya huruf A–Z kapital (untuk kode prefix). */
export const hanyaHurufKapital = (v: string) => v.toUpperCase().replace(/[^A-Z]+/g, "");

// ---------------------------------------------------------------------
// Skema zod (server)
// ---------------------------------------------------------------------
const tanpaKarakterKontrol = (v: string) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(v);

/** Teks satu baris wajib, panjang maksimal tertentu. */
export const teks = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} wajib diisi.`)
    .max(max, `${label} maksimal ${max} karakter.`)
    .refine(tanpaKarakterKontrol, `${label} berisi karakter yang tidak valid.`);

/** Teks opsional (kosong → null). */
export const teksOpsional = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max} karakter.`)
    .refine(tanpaKarakterKontrol, `${label} berisi karakter yang tidak valid.`)
    .optional()
    .transform((v) => v || null);

/** Nama orang: huruf, spasi, titik, koma, apostrof, tanda hubung (mis. "dr. Ayu Pratiwi", "I Gusti Ngurah"). */
export const namaOrang = (label = "Nama") =>
  teks(label, BATAS.namaOrang).regex(
    /^[\p{L}][\p{L}\s.,'’-]*$/u,
    `${label} hanya boleh berisi huruf, spasi, titik, koma, apostrof, dan tanda hubung.`,
  );

/** Nomor kontak Indonesia: 10–15 angka, diawali 0 atau 62 (spasi/tanda hubung/+ diabaikan). */
export const nomorKontak = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.-]+/g, "").replace(/^\+/, ""))
  .pipe(
    z
      .string()
      .min(1, "Nomor kontak wajib diisi.")
      .regex(/^\d+$/, "Nomor kontak hanya boleh berisi angka.")
      .regex(/^(0|62)/, "Nomor kontak harus diawali 0 atau 62.")
      .min(BATAS.kontakMin, `Nomor kontak minimal ${BATAS.kontakMin} angka.`)
      .max(BATAS.kontakMax, `Nomor kontak maksimal ${BATAS.kontakMax} angka.`),
  );

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(BATAS.email, `Email maksimal ${BATAS.email} karakter.`)
  .pipe(z.email("Format email tidak valid."));

export const password = z
  .string()
  .min(BATAS.passwordMin, `Password minimal ${BATAS.passwordMin} karakter.`)
  .max(BATAS.passwordMax, `Password maksimal ${BATAS.passwordMax} karakter.`)
  .regex(/[A-Za-z]/, "Password harus mengandung huruf.")
  .regex(/\d/, "Password harus mengandung angka.");

export const kodePrefix = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,5}$/, "Kode prefix harus 2–5 huruf kapital, contoh LPT.");
