// Kompresi gambar di browser sebelum diunggah.

const MAX_WIDTH = 1600;
const QUALITY = 0.8;

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Jatuh ke <img> (mis. browser lama).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Perkecil ke lebar maksimal 1600 px dan ubah ke JPEG. */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} bukan file gambar.`);

  const bmp = await loadBitmap(file);
  const srcW = "naturalWidth" in bmp ? bmp.naturalWidth : bmp.width;
  const srcH = "naturalHeight" in bmp ? bmp.naturalHeight : bmp.height;
  const scale = Math.min(1, MAX_WIDTH / srcW);
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung kompresi gambar.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  if ("close" in bmp) bmp.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new Error(`Gagal mengompres ${file.name}.`);
  return blob;
}
