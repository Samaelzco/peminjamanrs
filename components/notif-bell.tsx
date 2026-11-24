"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { HiOutlineBell } from "react-icons/hi2";
import { bacaNotifikasi, bacaSemuaNotifikasi } from "@/app/(app)/notifikasi-actions";

export type NotifItem = {
  id: number;
  pesan: string;
  peminjamanId: number | null;
  sudahDibaca: boolean;
  waktu: string; // sudah diformat WITA
};

export function NotifBell({ unread, items }: { unread: number; items: NotifItem[] }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
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
        className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100"
        aria-label={`Notifikasi, ${unread} belum dibaca`}
        aria-expanded={open}
      >
        <HiOutlineBell className="h-6 w-6" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">Notifikasi</p>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs font-medium text-cyan-700 hover:underline"
                onClick={() => startTransition(() => bacaSemuaNotifikasi())}
              >
                Tandai semua dibaca
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-500">Belum ada notifikasi.</li>}
            {items.map((n) => {
              const content = (
                <>
                  <p className={`text-sm ${n.sudahDibaca ? "text-gray-600" : "font-medium text-gray-900"}`}>{n.pesan}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{n.waktu}</p>
                </>
              );
              const cls = `block px-4 py-3 hover:bg-gray-50 ${n.sudahDibaca ? "" : "bg-cyan-50/60"}`;
              const mark = () => {
                setOpen(false);
                if (!n.sudahDibaca) startTransition(() => bacaNotifikasi(n.id));
              };
              return (
                <li key={n.id}>
                  {n.peminjamanId ? (
                    <Link href={`/peminjaman/${n.peminjamanId}`} className={cls} onClick={mark}>
                      {content}
                    </Link>
                  ) : (
                    <button type="button" className={`${cls} w-full text-left`} onClick={mark}>
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
