// Label dan warna pill untuk enum. Aman diimpor dari client.
import type { Database } from "@/lib/database.types";
import type { Tone } from "@/components/ui";

type Enums = Database["public"]["Enums"];
export type StatusAset = Enums["status_aset"];
export type KondisiAset = Enums["kondisi_aset"];

export const STATUS_ASET: Record<StatusAset, { label: string; tone: Tone }> = {
  tersedia: { label: "Tersedia", tone: "green" },
  dipinjam: { label: "Dipinjam", tone: "blue" },
  dalam_perbaikan: { label: "Perbaikan", tone: "yellow" },
  hilang: { label: "Hilang", tone: "red" },
};

export const KONDISI: Record<"baik" | "rusak" | "hilang", { label: string; tone: Tone }> = {
  baik: { label: "Baik", tone: "green" },
  rusak: { label: "Rusak", tone: "yellow" },
  hilang: { label: "Hilang", tone: "red" },
};

export const STATUS_ASET_LIST = Object.keys(STATUS_ASET) as StatusAset[];
export const KONDISI_ASET_LIST: KondisiAset[] = ["baik", "rusak"];

export type StatusPeminjaman = Enums["status_peminjaman"];
export type KondisiMasuk = Enums["kondisi_masuk"];

export const STATUS_PEMINJAMAN: Record<StatusPeminjaman, { label: string; tone: Tone }> = {
  diajukan: { label: "Menunggu Pemasangan", tone: "yellow" },
  dipinjam: { label: "Dipinjam", tone: "blue" },
  terlambat: { label: "Terlambat", tone: "red" },
  dibatalkan: { label: "Dibatalkan", tone: "gray" },
  selesai: { label: "Selesai", tone: "green" },
};

export const STATUS_PEMINJAMAN_LIST = Object.keys(STATUS_PEMINJAMAN) as StatusPeminjaman[];
