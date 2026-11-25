"use client";

import { useState } from "react";
import { Sheet } from "@/components/overlay";

export function PhotoGallery({ title, photos }: { title: string; photos: { path: string; url: string | null }[] }) {
  const [open, setOpen] = useState<{ url: string; i: number } | null>(null);

  if (photos.length === 0) return <p className="text-sm text-gray-500">Tidak ada foto.</p>;

  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
        {photos.map((p, i) => (
          <li key={p.path}>
            {p.url ? (
              <button
                type="button"
                onClick={() => setOpen({ url: p.url!, i })}
                className="block aspect-square w-full overflow-hidden rounded-lg border border-gray-200 transition-opacity duration-200 hover:opacity-90"
                aria-label={`Perbesar ${title} ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`${title} ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
              </button>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-gray-300 p-1 text-center text-xs text-gray-400">
                Tidak dapat dimuat
              </div>
            )}
          </li>
        ))}
      </ul>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={`${title} (${(open?.i ?? 0) + 1}/${photos.length})`} size="lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {open && <img src={open.url} alt={title} className="mx-auto max-h-[70dvh] w-auto rounded-lg" />}
      </Sheet>
    </>
  );
}
