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
import { BATAS, kodePrefix, teks } from "@/lib/validation";

const schema = z.object({
  nama: teks("Nama kategori", BATAS.namaKategori),
  kode_prefix: kodePrefix,
});

const idSchema = z.coerce.number().int().positive();

export type KategoriInput = z.input<typeof schema>;

function uniqueMessage(message: string) {
  return message.includes("kode_prefix")
    ? "Kode prefix sudah dipakai kategori lain."
    : "Nama kategori sudah dipakai.";
}

export async function createKategori(input: KategoriInput): Promise<ActionResult> {
  return runAction(async () => {
    await authorize("kategori.create");
    const parsed = schema.safeParse(input);
    if (!parsed.success) return validationError(parsed.error);

    const supabase = await createClient();
    const { error } = await supabase.from("kategori").insert(parsed.data);
    if (error) {
      return { ok: false, error: error.code === "23505" ? uniqueMessage(error.message) : dbErrorMessage(error) };
    }
    refresh();
    return { ok: true, message: `Kategori "${parsed.data.nama}" berhasil ditambahkan.` };
  });
}

export async function updateKategori(id: number, input: KategoriInput): Promise<ActionResult> {
  return runAction(async () => {
    await authorize("kategori.update");
    const kategoriId = idSchema.parse(id);
    const parsed = schema.safeParse(input);
    if (!parsed.success) return validationError(parsed.error);

    const supabase = await createClient();
    const { error } = await supabase.from("kategori").update(parsed.data).eq("id", kategoriId);
    if (error) {
      return { ok: false, error: error.code === "23505" ? uniqueMessage(error.message) : dbErrorMessage(error) };
    }
    refresh();
    return { ok: true, message: "Kategori berhasil diperbarui." };
  });
}

export async function deleteKategori(id: number): Promise<ActionResult> {
  return runAction(async () => {
    await authorize("kategori.delete");
    const kategoriId = idSchema.parse(id);

    const supabase = await createClient();
    const { data, error } = await supabase.from("kategori").delete().eq("id", kategoriId).select("nama");
    if (error) return { ok: false, error: dbErrorMessage(error) };
    if (!data?.length) return { ok: false, error: "Kategori tidak ditemukan." };

    refresh();
    return { ok: true, message: `Kategori "${data[0].nama}" berhasil dihapus.` };
  });
}
