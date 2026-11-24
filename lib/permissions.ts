// Daftar permission (sama dengan seed di migration). Aman diimpor dari client.
export const PERMISSIONS = [
  "dashboard.view",
  "user.view",
  "user.create",
  "user.update",
  "user.toggle-status",
  "role.view",
  "role.manage",
  "kategori.view",
  "kategori.create",
  "kategori.update",
  "kategori.delete",
  "aset.view",
  "aset.create",
  "aset.update",
  "aset.delete",
  "peminjaman.view",
  "peminjaman.create",
  "peminjaman.cancel",
  "peminjaman.extend",
  "pemasangan.create",
  "pengembalian.create",
  "riwayat.view",
  "debug.reset",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function hasPermission(perms: readonly string[], p: Permission) {
  return perms.includes(p);
}
