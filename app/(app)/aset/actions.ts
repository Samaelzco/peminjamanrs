"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  authorize,
  dbErrorMessage,
  runAction,
  validationError,
  type ActionResult,
} from "@/lib/action";
import { createClient } from "@/lib/supabase/server";
import { BATAS, teks, teksOpsional } from "@/lib/validation";

const createSchema = z.object({
  kategori_id: z.coerce.number().int().positive("Kategori wajib dipilih."),
  nama_aset: teks("Nama aset", BATAS.namaAset),
  deskripsi: teksOpsional("Deskripsi", BATAS.deskripsiAset),
  kondisi: z.enum(["baik", "rusak"], "Kondisi tidak valid."),
  status: z.enum(["tersedia", "dalam_perbaikan", "hilang"], "Status tidak valid."),
});

const updateSchema = z.object({
  nama_aset: teks("Nama aset", BATAS.namaAset),
  deskripsi: teksOpsional("Deskripsi", BATAS.deskripsiAset),
  kondisi: z.enum(["baik", "rusak"], "Kondisi tidak valid."),
  // 'dipinjam' hanya boleh muncul kalau status tidak berubah (dicek ulang oleh trigger DB).
  status: z.enum(["tersedia", "dipinjam", "dalam_perbaikan", "hilang"], "Status tidak valid."),
});

const idSchema = z.coerce.number().int().positive();

export type AsetCreateInput = z.input<typeof createSchema>;
export type AsetUpdateInput = z.input<typeof updateSchema>;

export async function createAset(input: AsetCreateInput): Promise<ActionResult> {
  return runAction(async () => {
    await authorize("aset.create");
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return validationError(parsed.error);

    const supabase = await createClient();
    // kode_aset dibuat otomatis oleh trigger database.
    const { data, error } = await supabase.from("aset").insert(parsed.data).select("kode_aset").single();
    if (error) return { ok: false, error: dbErrorMessage(error) };

    refresh();
    return { ok: true, message: `Aset ${data.kode_aset} berhasil ditambahkan.` };
  });
}

export async function updateAset(id: number, input: AsetUpdateInput): Promise<ActionResult> {
  return runAction(async () => {
    await authorize("aset.update");
    const asetId = idSchema.parse(id);
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return validationError(parsed.error);

    const supabase = await createClient();
    const { data: before } = await supabase.from("aset").select("status").eq("id", asetId).single();
    if (!before) return { ok: false, error: "Aset tidak ditemukan." };
    if (before.status !== parsed.data.status && (before.status === "dipinjam" || parsed.data.status === "dipinjam")) {
      return {
        ok: false,
        error: 'Status "dipinjam" hanya diatur oleh alur peminjaman dan tidak dapat diubah manual.',
      };
    }

    const { error } = await supabase.from("aset").update(parsed.data).eq("id", asetId);
    if (error) return { ok: false, error: dbErrorMessage(error) };

    refresh();
    return { ok: true, message: "Aset berhasil diperbarui." };
  });
}

export async function deleteAset(id: number): Promise<ActionResult> {
  return runAction(async () => {
    await authorize("aset.delete");
    const asetId = idSchema.parse(id);

    const supabase = await createClient();
    const { data, error } = await supabase.from("aset").delete().eq("id", asetId).select("kode_aset");
    if (error) return { ok: false, error: dbErrorMessage(error) };
    if (!data?.length) return { ok: false, error: "Aset tidak ditemukan." };

    refresh();
    return { ok: true, message: `Aset ${data[0].kode_aset} berhasil dihapus.` };
  });
}
