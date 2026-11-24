"use client";

import { useState } from "react";
import { Modal, ModalBody, ModalHeader } from "flowbite-react";

export function PhotoGallery({ title, photos }: { title: string; photos: { path: string; url: string | null }[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (photos.length === 0) return <p className="text-sm text-gray-500">Tidak ada foto.</p>;

  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((p, i) => (
          <li key={p.path}>
            {p.url ? (
              <button
                type="button"
                onClick={() => setOpen(p.url)}
                className="block aspect-square w-full overflow-hidden rounded-lg border border-gray-200 hover:opacity-90"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`${title} ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
              </button>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed text-xs text-gray-400">
                Tidak dapat dimuat
              </div>
            )}
          </li>
        ))}
      </ul>
      <Modal show={!!open} size="5xl" onClose={() => setOpen(null)} dismissible>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {open && <img src={open} alt={title} className="mx-auto max-h-[75vh] w-auto" />}
        </ModalBody>
      </Modal>
    </>
  );
}
