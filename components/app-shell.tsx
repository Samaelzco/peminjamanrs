"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "flowbite-react";
import {
  HiOutlineArchiveBox,
  HiOutlineArrowRightOnRectangle,
  HiOutlineBars3,
  HiOutlineBugAnt,
  HiOutlineClock,
  HiOutlineKey,
  HiOutlinePlusCircle,
  HiOutlineSquares2X2,
  HiOutlineTag,
  HiOutlineUsers,
  HiOutlineXMark,
} from "react-icons/hi2";
import type { MenuIcon, MenuItem } from "@/lib/menu";
import { logout } from "@/app/(auth)/login/actions";

const ICONS: Record<MenuIcon, typeof HiOutlineSquares2X2> = {
  dashboard: HiOutlineSquares2X2,
  baru: HiOutlinePlusCircle,
  riwayat: HiOutlineClock,
  aset: HiOutlineArchiveBox,
  kategori: HiOutlineTag,
  akun: HiOutlineUsers,
  role: HiOutlineKey,
  debug: HiOutlineBugAnt,
};

type Props = {
  menu: MenuItem[];
  user: { nama: string; email: string; roleNama: string };
  headerRight?: ReactNode;
  children: ReactNode;
};

export function AppShell({ menu, user, headerRight, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Menu utama"
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
          <Link href="/" className="leading-tight" onClick={() => setOpen(false)}>
            <span className="block text-xs font-medium text-cyan-700">RSUP Prof. Ngoerah</span>
            <span className="block font-semibold text-gray-900">Peminjaman Perangkat</span>
          </Link>
          <button
            type="button"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
          >
            <HiOutlineXMark className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {menu.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                      active ? "bg-cyan-50 text-cyan-800" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-gray-200 p-4">
          <p className="truncate text-sm font-semibold text-gray-900">{user.nama}</p>
          <p className="truncate text-xs text-gray-500">{user.email}</p>
          <p className="mt-0.5 text-xs text-cyan-700">{user.roleNama}</p>
          <form action={logout} className="mt-3">
            <Button type="submit" color="light" size="xs" className="w-full">
              <HiOutlineArrowRightOnRectangle className="me-1.5 h-4 w-4" />
              Keluar
            </Button>
          </form>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-gray-900/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="rounded p-1.5 text-gray-600 hover:bg-gray-100 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Buka menu"
          >
            <HiOutlineBars3 className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">{headerRight}</div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
