"use client";

import { useEffect, useRef, useState } from "react";
import { LuCamera, LuPlus, LuX } from "react-icons/lu";
import { FieldError, Spinner } from "@/components/ui";
import { compressImage } from "@/lib/image";

export type PickedPhoto = { id: string; blob: Blob; url: string; size: number };

const TILE =
  "flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-sm font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50";

export function PhotoPicker({
  photos,
  onChange,
  disabled,
  error,
}: {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  disabled?: boolean;
  error?: string;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Bersihkan object URL saat komponen dilepas.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setLocalError(null);
    const added: PickedPhoto[] = [];
    try {
      for (const file of Array.from(files)) {
        const blob = await compressImage(file);
        added.push({ id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob), size: blob.size });
      }
      onChange([...photos, ...added]);
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  function remove(id: string) {
    const target = photos.find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.url);
    onChange(photos.filter((p) => p.id !== id));
  }

  return (
    <div>
      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {photos.map((p) => (
          <li key={p.id} className="relative aspect-square overflow-hidden rounded-lg border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="Pratinjau foto" className="h-full w-full object-cover" />
            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
              {Math.round(p.size / 1024)} KB
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="absolute top-1 right-1 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-gray-700 shadow hover:bg-white"
                aria-label="Hapus foto"
              >
                <LuX className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
        <li>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => galleryRef.current?.click()}
            className={`${TILE} w-full border-brand-300 bg-brand-50/50 text-brand-700 hover:bg-brand-50`}
          >
            {busy ? <Spinner className="h-5 w-5" /> : <LuPlus className="h-6 w-6" aria-hidden />}
            {busy ? "Proses..." : "Foto"}
          </button>
        </li>
        <li>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => cameraRef.current?.click()}
            className={`${TILE} w-full border-gray-300 text-gray-600 hover:bg-gray-50`}
          >
            <LuCamera className="h-6 w-6" aria-hidden />
            Kamera
          </button>
        </li>
      </ul>
      {/* capture membuka kamera langsung di HP */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <FieldError>{error ?? localError}</FieldError>
    </div>
  );
}
