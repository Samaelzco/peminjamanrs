// Unggah foto langsung dari browser ke Storage (policy Storage memeriksa permission).
import { createClient } from "@/lib/supabase/client";

export const BUCKET_FOTO = "foto-peminjaman";

export async function uploadPhotos(
  jenis: "pemasangan" | "pengembalian",
  id: number,
  blobs: Blob[],
  onProgress?: (done: number) => void,
): Promise<string[]> {
  const supabase = createClient();
  const paths: string[] = [];
  try {
    for (const blob of blobs) {
      const path = `${jenis}/${id}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from(BUCKET_FOTO)
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw new Error(`Gagal mengunggah foto: ${error.message}`);
      paths.push(path);
      onProgress?.(paths.length);
    }
    return paths;
  } catch (e) {
    await removePhotos(paths);
    throw e;
  }
}

/** Hapus foto yang sudah terunggah tetapi gagal disimpan. */
export async function removePhotos(paths: string[]) {
  if (!paths.length) return;
  const supabase = createClient();
  await supabase.storage.from(BUCKET_FOTO).remove(paths);
}
