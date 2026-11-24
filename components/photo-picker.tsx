"use client";

import { useEffect, useRef, useState } from "react";
import { Button, HelperText, Spinner } from "flowbite-react";
import { HiOutlineCamera, HiOutlinePhoto, HiOutlineXMark } from "react-icons/hi2";
import { compressImage } from "@/lib/image";

export type PickedPhoto = { id: string; blob: Blob; url: string; size: number };

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
      <div className="flex flex-wrap gap-2">
        <Button type="button" color="light" disabled={disabled || busy} onClick={() => cameraRef.current?.click()}>
          <HiOutlineCamera className="me-1.5 h-4 w-4" />
          Ambil Foto
        </Button>
        <Button type="button" color="light" disabled={disabled || busy} onClick={() => galleryRef.current?.click()}>
          <HiOutlinePhoto className="me-1.5 h-4 w-4" />
          Pilih dari Galeri
        </Button>
        {busy && (
          <span className="flex items-center gap-2 text-sm text-gray-500">
            <Spinner size="sm" /> Mengompres...
          </span>
        )}
      </div>
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

      {photos.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {photos.map((p) => (
            <li key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="Pratinjau foto" className="h-full w-full object-cover" />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                {Math.round(p.size / 1024)} KB
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  className="absolute top-1 right-1 rounded-full bg-white/90 p-1 text-gray-700 shadow hover:bg-white"
                  aria-label="Hapus foto"
                >
                  <HiOutlineXMark className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <HelperText color={error || localError ? "failure" : undefined}>
        {error ?? localError ?? `${photos.length} foto. Minimal 1 foto. Foto otomatis dikompres (lebar maks. 1600 px).`}
      </HelperText>
    </div>
  );
}
