// Data sesi yang sudah diperiksa proxy diteruskan ke render lewat header request internal,
// sehingga layout/halaman/server action tidak perlu mengulang query yang sama ke database.
// Proxy SELALU menimpa atau menghapus header ini, jadi nilai kiriman klien tidak pernah sampai.
import type { Permission } from "@/lib/permissions";

export const AKSES_HEADER = "x-peminjaman-akses";

export type AksesSesi = {
  id: string;
  nama: string;
  email: string;
  roleId: number;
  roleNama: string;
  permissions: Permission[];
};

export function encodeAkses(a: AksesSesi): string {
  return encodeURIComponent(JSON.stringify(a));
}

export function decodeAkses(v: string | null): AksesSesi | null {
  if (!v) return null;
  try {
    const a = JSON.parse(decodeURIComponent(v)) as AksesSesi;
    return typeof a?.id === "string" && Array.isArray(a.permissions) ? a : null;
  } catch {
    return null;
  }
}
