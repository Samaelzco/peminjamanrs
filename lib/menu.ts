import type { Permission } from "@/lib/permissions";

export type MenuIcon = "dashboard" | "baru" | "riwayat" | "aset" | "kategori" | "akun" | "role" | "debug";
export type MenuItem = { href: string; label: string; permission: Permission; icon: MenuIcon };

export const MENU: MenuItem[] = [
  { href: "/", label: "Dashboard", permission: "dashboard.view", icon: "dashboard" },
  { href: "/peminjaman/baru", label: "Peminjaman Baru", permission: "peminjaman.create", icon: "baru" },
  { href: "/riwayat", label: "Riwayat Peminjaman", permission: "riwayat.view", icon: "riwayat" },
  { href: "/aset", label: "Data Aset", permission: "aset.view", icon: "aset" },
  { href: "/kategori", label: "Kategori", permission: "kategori.view", icon: "kategori" },
  { href: "/akun", label: "Kelola Akun", permission: "user.view", icon: "akun" },
  { href: "/role", label: "Role & Permission", permission: "role.view", icon: "role" },
  { href: "/debug", label: "Debug", permission: "debug.reset", icon: "debug" },
];

export function menuFor(permissions: readonly string[], opsi: { debug?: boolean } = {}) {
  return MENU.filter((m) => permissions.includes(m.permission) && (m.icon !== "debug" || opsi.debug));
}
