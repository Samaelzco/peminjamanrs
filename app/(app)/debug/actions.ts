"use server";

import { refresh } from "next/cache";
import { authorize, runAction, type ActionResult } from "@/lib/action";
import { debugAktif } from "@/lib/debug";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "foto-peminjaman";

/** Hapus semua file di bawah folder pemasangan/ dan pengembalian/. */
async function hapusSemuaFoto(admin: ReturnType<typeof createAdminClient>) {
  let total = 0;
  for (const root of ["pemasangan", "pengembalian"]) {
    const { data: folders, error } = await admin.storage.from(BUCKET).list(root, { limit: 1000 });
    if (error) throw new Error(`Gagal membaca Storage: ${error.message}`);
    for (const f of folders ?? []) {
      const { data: files } = await admin.storage.from(BUCKET).list(`${root}/${f.name}`, { limit: 1000 });
      const paths = (files ?? []).map((x) => `${root}/${f.name}/${x.name}`);
      if (paths.length) {
        const { error: e2 } = await admin.storage.from(BUCKET).remove(paths);
        if (e2) throw new Error(`Gagal menghapus foto: ${e2.message}`);
        total += paths.length;
      }
    }
  }
  return total;
}

export async function resetDataDemo(konfirmasi: string): Promise<ActionResult> {
  return runAction(async () => {
    if (!debugAktif()) return { ok: false, error: "Halaman debug tidak aktif." };
    await authorize("debug.reset");
    if (konfirmasi !== "RESET") return { ok: false, error: 'Ketik "RESET" untuk konfirmasi.' };

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("reset_data_demo");
    if (error) return { ok: false, error: `Reset gagal: ${error.message}` };

    let foto = 0;
    let catatanFoto = "";
    try {
      foto = await hapusSemuaFoto(admin);
    } catch (e) {
      catatanFoto = ` Namun sebagian foto gagal dihapus: ${(e as Error).message}`;
    }

    const r = data as { peminjaman_dihapus: number; aset_lain_dihapus: number; kategori_lain_dihapus: number };
    refresh();
    return {
      ok: true,
      message:
        `Reset selesai: ${r.peminjaman_dihapus} peminjaman dan ${foto} foto dihapus` +
        (r.aset_lain_dihapus ? `, ${r.aset_lain_dihapus} aset tambahan dihapus` : "") +
        (r.kategori_lain_dihapus ? `, ${r.kategori_lain_dihapus} kategori tambahan dihapus` : "") +
        ". 8 aset demo kembali tersedia/baik." +
        catatanFoto,
    };
  });
}
