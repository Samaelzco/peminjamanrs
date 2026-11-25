"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LuBox, LuChevronRight, LuCirclePlus, LuClock, LuHouse, LuLogOut, LuTag, LuUsers } from "react-icons/lu";
import type { IconType } from "react-icons";
import { BrandMark } from "@/components/brand";
import { cn } from "@/components/ui";
import { tabsFor, type MenuIcon, type MenuItem } from "@/lib/menu";
import { logout } from "@/app/(auth)/login/actions";

const ICONS: Record<MenuIcon, IconType> = {
  dashboard: LuHouse,
  baru: LuCirclePlus,
  riwayat: LuClock,
  aset: LuBox,
  kategori: LuTag,
  akun: LuUsers,
};

type User = { nama: string; email: string; roleNama: string };

type Props = {
  menu: MenuItem[];
  user: User;
  headerRight?: ReactNode;
  children: ReactNode;
};

export function inisial(nama: string) {
  const kata = nama.replace(/^(dr|ns|bpk|ibu)\.?\s+/i, "").trim().split(/\s+/);
  return ((kata[0]?.[0] ?? "") + (kata.length > 1 ? kata[kata.length - 1][0] : (kata[0]?.[1] ?? ""))).toUpperCase();
}

export function AppShell({ menu, user, headerRight, children }: Props) {
  const pathname = usePathname();
  const { tabs, sisa } = tabsFor(menu);

  // Menu paling spesifik yang cocok dengan URL yang aktif.
  const aktif = menu
    .filter((m) => (m.href === "/" ? pathname === "/" : pathname === m.href || pathname.startsWith(`${m.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="min-h-dvh">
      {/* Sidebar desktop */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-gray-200 bg-white lg:flex"
        aria-label="Menu utama"
      >
        <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-5">
          <Link href="/" className="rounded-md" aria-label="Ke dashboard">
            <BrandMark className="h-9" />
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {menu.map((item) => {
              const Icon = ICONS[item.icon];
              const active = aktif === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-200",
                      active
                        ? "bg-brand-50 font-semibold text-brand-800"
                        : "font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    <span className="flex-1">{item.label}</span>
                    {active && <LuChevronRight className="h-4 w-4" aria-hidden />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-gray-200 p-3">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <Avatar nama={user.nama} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{user.nama}</p>
              <p className="truncate text-xs text-gray-500">{user.roleNama}</p>
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-800"
            >
              <LuLogOut className="h-5 w-5" aria-hidden />
              Keluar
            </button>
          </form>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 md:px-6 lg:h-16 lg:grid-cols-[1fr_auto] lg:px-8">
            <Link href="/" className="justify-self-start rounded-md lg:hidden" aria-label="Ke dashboard">
              <BrandMark className="h-7" priority />
            </Link>
            <p className="truncate text-center text-base font-semibold text-gray-900 lg:text-left lg:text-sm lg:font-medium lg:text-gray-500">
              <span className="lg:hidden">Peminjaman Barang</span>
              <span className="hidden lg:inline">Sistem Peminjaman Barang · RSUP Prof. Ngoerah</span>
            </p>
            <div className="flex items-center justify-end gap-1">
              {headerRight}
              <AccountMenu user={user} sisa={sisa} />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-6 md:pt-6 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Tab bar ponsel & tablet */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Navigasi utama"
      >
        <ul className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((item) => {
            const Icon = ICONS[item.icon];
            const active = aktif === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-center text-[11px] leading-tight tracking-[-0.01em] whitespace-nowrap transition-colors duration-200 sm:text-xs",
                    active ? "font-semibold text-brand-700" : "font-medium text-gray-600 hover:text-gray-900",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function Avatar({ nama, className }: { nama: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-800",
        className,
      )}
      aria-hidden
    >
      {inisial(nama)}
    </span>
  );
}

/** Avatar di top bar: info akun, menu yang tidak muat di tab bar, dan tombol keluar. */
function AccountMenu({ user, sisa }: { user: User; sisa: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-11 w-11 place-items-center rounded-full"
        aria-label={`Akun ${user.nama}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar nama={user.nama} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-[min(18rem,calc(100vw-2rem))] animate-pop-in overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center gap-3 border-b border-gray-100 p-4">
            <Avatar nama={user.nama} className="h-10 w-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{user.nama}</p>
              <p className="truncate text-xs text-gray-500">{user.email}</p>
              <p className="mt-0.5 truncate text-xs font-medium text-brand-700">{user.roleNama}</p>
            </div>
          </div>
          {sisa.length > 0 && (
            <ul className="border-b border-gray-100 p-2 lg:hidden">
              {sisa.map((item) => {
                const Icon = ICONS[item.icon];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                      <Icon className="h-5 w-5 text-gray-500" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <form action={logout} className="p-2">
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-sm font-medium text-red-800 hover:bg-red-50"
            >
              <LuLogOut className="h-5 w-5" aria-hidden />
              Keluar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
