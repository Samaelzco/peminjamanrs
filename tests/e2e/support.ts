import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Browser, Page } from "@playwright/test";
import type { Database } from "../../lib/database.types";

export const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/** Klien API sebagai user tertentu (untuk uji pemanggilan API/RPC langsung). */
export async function apiSebagai(email: string, password: string) {
  const c = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

export const AKUN = {
  admin: { email: process.env.SEED_ADMIN_EMAIL!, password: process.env.SEED_ADMIN_PASSWORD! },
  sarpras: { email: process.env.SEED_SARPRAS_EMAIL!, password: process.env.SEED_SARPRAS_PASSWORD! },
};

export const DIR_SCREENSHOT = path.join("tests", "screenshots");
export const DIR_FIXTURE = path.join("tests", "fixtures");

// ---------------------------------------------------------------------
// Pencatatan hasil per langkah (untuk laporan)
// ---------------------------------------------------------------------
export type Hasil = {
  langkah: string;
  harapan: string;
  hasil: string;
  status: "lulus" | "gagal";
  screenshot?: string;
};

export const hasil: Hasil[] = [];
export const sqlLog: { langkah: string; sql: string; hasil: string }[] = [];
export const pemetaan: Record<string, { id: number; kode: string }> = {};

/**
 * Jalankan satu pemeriksaan. fn mengembalikan deskripsi hasil sebenarnya (string) atau melempar error.
 * Kegagalan dicatat + screenshot, lalu pengujian berlanjut.
 */
export async function cek(page: Page | null, langkah: string, harapan: string, fn: () => Promise<string>) {
  try {
    const h = await fn();
    hasil.push({ langkah, harapan, hasil: h, status: "lulus" });
    console.log(`  ✅ ${langkah}: ${h}`);
  } catch (e) {
    let screenshot: string | undefined;
    if (page) {
      screenshot = path.join(DIR_SCREENSHOT, `gagal-${langkah.replace(/[^\w.-]+/g, "_")}.png`);
      await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    }
    const msg = (e as Error).message.split("\n").slice(0, 6).join(" ").slice(0, 600);
    hasil.push({ langkah, harapan, hasil: msg, status: "gagal", screenshot });
    console.log(`  ❌ ${langkah}: ${msg}`);
  }
}

export function assert(cond: unknown, pesan: string): asserts cond {
  if (!cond) throw new Error(pesan);
}

export function simpanHasil() {
  fs.writeFileSync(
    path.join("tests", "e2e", "hasil-terakhir.json"),
    JSON.stringify({ waktu: new Date().toISOString(), pemetaan, hasil, sqlLog }, null, 2),
  );
}

// ---------------------------------------------------------------------
// Foto dummy 800x600 (dibuat lewat canvas Chromium)
// ---------------------------------------------------------------------
export async function siapkanFotoDummy(browser: Browser, jumlah = 5) {
  fs.mkdirSync(DIR_FIXTURE, { recursive: true });
  const files = Array.from({ length: jumlah }, (_, i) => path.join(DIR_FIXTURE, `foto-dummy-${i + 1}.jpg`));
  if (files.every((f) => fs.existsSync(f))) return files;

  const page = await browser.newPage();
  const warna = ["#0e7490", "#15803d", "#b45309", "#7c3aed", "#be123c"];
  for (let i = 0; i < jumlah; i++) {
    const dataUrl = await page.evaluate(
      ({ w, label }) => {
        const c = document.createElement("canvas");
        c.width = 800;
        c.height = 600;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = w;
        ctx.fillRect(0, 0, 800, 600);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 48px sans-serif";
        ctx.fillText(label, 60, 320);
        return c.toDataURL("image/jpeg", 0.85);
      },
      { w: warna[i % warna.length], label: `Foto dummy ${i + 1}` },
    );
    fs.writeFileSync(files[i], Buffer.from(dataUrl.split(",")[1], "base64"));
  }
  await page.close();
  return files;
}

// ---------------------------------------------------------------------
// Utilitas waktu: nilai <input type="datetime-local"> dalam WITA
// ---------------------------------------------------------------------
export function witaInput(msDariSekarang: number) {
  return new Date(Date.now() + msDariSekarang + 8 * 3600_000).toISOString().slice(0, 16);
}
export const JAM = 3600_000;
export const HARI = 24 * JAM;
