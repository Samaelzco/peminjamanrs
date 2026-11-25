"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { LuBell } from "react-icons/lu";
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
        className="relative grid h-11 w-11 place-items-center rounded-full text-gray-600 hover:bg-gray-100"
        aria-label={`Notifikasi, ${unread} belum dibaca`}
        aria-expanded={open}
      >
        <LuBell className="h-5 w-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-700 px-1 text-[11px] ring-2 ring-white font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-4 top-[calc(3.75rem+env(safe-area-inset-top))] z-50 animate-pop-in overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-1 sm:w-96">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">Notifikasi</p>
            {unread > 0 && (
              <button
                type="button"
                className="min-h-8 rounded-md px-1 text-xs font-semibold text-brand-700 hover:underline"
                onClick={() => startTransition(() => bacaSemuaNotifikasi())}
              >
                Tandai semua dibaca
              </button>
            )}
          </div>
          <ul className="max-h-[min(24rem,70dvh)] divide-y divide-gray-100 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-500">Belum ada notifikasi.</li>}
            {items.map((n) => {
              const content = (
                <>
                  <p className={`text-sm ${n.sudahDibaca ? "text-gray-600" : "font-medium text-gray-900"}`}>{n.pesan}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{n.waktu}</p>
                </>
              );
              const cls = `block px-4 py-3 hover:bg-gray-50 ${n.sudahDibaca ? "" : "bg-brand-50/60"}`;
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
