import type { Permission } from "@/lib/permissions";

/**
 * Permission yang dibutuhkan setiap rute halaman (cukup salah satu).
 * Dicek di proxy.ts (status HTTP 403) dan diulang di halaman (requirePermission).
 * Urutan penting: pola yang lebih spesifik di atas.
 */
const RUTE: { pola: RegExp; permission: Permission[] }[] = [
  { pola: /^\/peminjaman\/baru\/?$/, permission: ["peminjaman.create"] },
  { pola: /^\/peminjaman\/\d+\/pemasangan\/?$/, permission: ["pemasangan.create"] },
  { pola: /^\/peminjaman\/\d+\/pengembalian\/?$/, permission: ["pengembalian.create"] },
  { pola: /^\/peminjaman\/\d+\/perpanjang\/?$/, permission: ["peminjaman.extend"] },
  { pola: /^\/peminjaman\/\d+\/ubah\/?$/, permission: ["peminjaman.update"] },
  { pola: /^\/peminjaman\/\d+\/?$/, permission: ["peminjaman.view", "riwayat.view"] },
  { pola: /^\/riwayat\/ekspor\/?$/, permission: ["laporan.export"] },
  { pola: /^\/riwayat(\/|$)/, permission: ["riwayat.view"] },
  { pola: /^\/aset(\/|$)/, permission: ["aset.view"] },
  { pola: /^\/kategori(\/|$)/, permission: ["kategori.view"] },
  { pola: /^\/akun(\/|$)/, permission: ["user.view", "role.view"] },
  { pola: /^\/role(\/|$)/, permission: ["role.view"] },
  { pola: /^\/debug(\/|$)/, permission: ["debug.reset"] },
];

/** Permission untuk path ini, atau null bila rute tidak dibatasi permission khusus. */
export function permissionUntukRute(pathname: string): Permission[] | null {
  return RUTE.find((r) => r.pola.test(pathname))?.permission ?? null;
}
