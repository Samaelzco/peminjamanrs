// Label dan warna badge untuk enum. Aman diimpor dari client.
import type { Database } from "@/lib/database.types";

type Enums = Database["public"]["Enums"];
export type StatusAset = Enums["status_aset"];
export type KondisiAset = Enums["kondisi_aset"];

type BadgeColor = "success" | "warning" | "failure" | "info" | "gray" | "indigo" | "purple";

export const STATUS_ASET: Record<StatusAset, { label: string; color: BadgeColor }> = {
  tersedia: { label: "Tersedia", color: "success" },
  dipinjam: { label: "Dipinjam", color: "info" },
  dalam_perbaikan: { label: "Dalam Perbaikan", color: "warning" },
  hilang: { label: "Hilang", color: "failure" },
};

export const KONDISI: Record<"baik" | "rusak" | "hilang", { label: string; color: BadgeColor }> = {
  baik: { label: "Baik", color: "success" },
  rusak: { label: "Rusak", color: "warning" },
  hilang: { label: "Hilang", color: "failure" },
};

export const STATUS_ASET_LIST = Object.keys(STATUS_ASET) as StatusAset[];
export const KONDISI_ASET_LIST: KondisiAset[] = ["baik", "rusak"];
