import type { Permission } from "@/lib/permissions";

export type MenuIcon = "dashboard" | "baru" | "riwayat" | "aset" | "kategori" | "akun" | "role" | "debug";
export type MenuItem = { href: string; label: string; permission: Permission; icon: MenuIcon };

export const MENU: MenuItem[] = [
  { href: "/", label: "Dashboard", permission: "dashboard.view", icon: "dashboard" },
  { href: "/peminjaman/baru", label: "Peminjaman Baru", permission: "peminjaman.create", icon: "baru" },
  { href: "/riwayat", label: "Riwayat", permission: "riwayat.view", icon: "riwayat" },
  { href: "/aset", label: "Data Barang", permission: "aset.view", icon: "aset" },
  { href: "/kategori", label: "Kategori", permission: "kategori.view", icon: "kategori" },
  { href: "/akun", label: "Kelola Akun", permission: "user.view", icon: "akun" },
  { href: "/role", label: "Role & Permission", permission: "role.view", icon: "role" },
  { href: "/debug", label: "Debug", permission: "debug.reset", icon: "debug" },
];

export function menuFor(permissions: readonly string[], opsi: { debug?: boolean } = {}) {
  return MENU.filter((m) => permissions.includes(m.permission) && (m.icon !== "debug" || opsi.debug));
}

/**
 * Empat menu untuk tab bar bawah (ponsel/tablet), sesuai wireframe:
 * - yang bisa mencatat peminjaman (Administrasi): Dashboard, Peminjaman Baru, Riwayat, Kelola Akun
 * - lainnya (Sarpras): Dashboard, Data Barang, Kategori, Riwayat
 * Sisa menu tetap bisa dibuka dari menu akun (avatar).
 */
export function tabsFor(menu: MenuItem[]) {
  const punya = (i: MenuIcon) => menu.some((m) => m.icon === i);
  const urutan: MenuIcon[] = punya("baru")
    ? ["dashboard", "baru", "riwayat", "akun", "aset", "kategori"]
    : ["dashboard", "aset", "kategori", "riwayat", "akun"];
  const tabs = urutan
    .map((i) => menu.find((m) => m.icon === i))
    .filter((m): m is MenuItem => !!m)
    .slice(0, 4);
  const sisa = menu.filter((m) => !tabs.includes(m));
  return { tabs, sisa };
}
