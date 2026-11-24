"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { authorize, dbErrorMessage, runAction, type ActionResult } from "@/lib/action";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.coerce.number().int().positive();
const fotoSchema = z.array(z.string().min(1).max(200)).min(1, "Unggah minimal 1 foto.").max(30);

/** Pesan ID pemasangan / pengembalian untuk path foto. */
export async function reservasiId(
  jenis: "pemasangan" | "pengembalian",
  peminjamanId: number,
): Promise<ActionResult<number>> {
  return runAction<number>(async () => {
    await authorize(jenis === "pemasangan" ? "pemasangan.create" : "pengembalian.create");
    const pid = idSchema.parse(peminjamanId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("reservasi_id_kejadian", { p_jenis: jenis, p_peminjaman_id: pid });
    if (error || data == null) return { ok: false, error: error ? dbErrorMessage(error) : "Gagal memesan ID." };
    return { ok: true, data };
  });
}

export async function gantiUnit(detailId: number, asetBaruId: number, alasan: string): Promise<ActionResult> {
  return runAction(async () => {
    await authorize("pemasangan.create");
    const parsed = z
      .object({
        detailId: idSchema,
        asetBaruId: idSchema,
        alasan: z.string().trim().min(1, "Alasan penggantian wajib diisi.").max(300),
      })
      .safeParse({ detailId, asetBaruId, alasan });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

    const supabase = await createClient();
    const { error } = await supabase.rpc("ganti_unit_pemasangan", {
      p_detail_id: parsed.data.detailId,
      p_aset_baru_id: parsed.data.asetBaruId,
      p_alasan: parsed.data.alasan,
    });
    if (error) return { ok: false, error: dbErrorMessage(error) };
    refresh();
    return { ok: true, message: "Unit berhasil diganti. Unit lama ditandai dalam perbaikan." };
  });
}

const pemasanganSchema = z.object({
  peminjamanId: idSchema,
  pemasanganId: idSchema,
  units: z
    .array(z.object({ detail_id: idSchema, kondisi_keluar: z.enum(["baik", "rusak"], "Pilih kondisi keluar.") }))
    .min(1),
  foto: fotoSchema,
});

export async function simpanPemasangan(input: z.input<typeof pemasanganSchema>): Promise<ActionResult> {
  return runAction(async () => {
    await authorize("pemasangan.create");
    const parsed = pemasanganSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const d = parsed.data;

    const supabase = await createClient();
    const { error } = await supabase.rpc("simpan_pemasangan", {
      p_peminjaman_id: d.peminjamanId,
      p_pemasangan_id: d.pemasanganId,
      p_units: d.units,
      p_foto: d.foto,
    });
    if (error) return { ok: false, error: dbErrorMessage(error) };
    refresh();
    return { ok: true, message: "Pemasangan tersimpan. Status peminjaman: Dipinjam." };
  });
}

const pengembalianSchema = z.object({
  peminjamanId: idSchema,
  pengembalianId: idSchema,
  units: z
    .array(
      z
        .object({
          detail_id: idSchema,
          kondisi_masuk: z.enum(["baik", "rusak", "hilang"], "Pilih kondisi masuk."),
          catatan: z.string().trim().max(500).optional().default(""),
        })
        .refine((u) => u.kondisi_masuk === "baik" || u.catatan.length > 0, {
          message: "Catatan wajib diisi untuk unit yang rusak atau hilang.",
        }),
    )
    .min(1),
  foto: fotoSchema,
});

export async function simpanPengembalian(input: z.input<typeof pengembalianSchema>): Promise<ActionResult> {
  return runAction(async () => {
    await authorize("pengembalian.create");
    const parsed = pengembalianSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const d = parsed.data;

    const supabase = await createClient();
    const { error } = await supabase.rpc("simpan_pengembalian", {
      p_peminjaman_id: d.peminjamanId,
      p_pengembalian_id: d.pengembalianId,
      p_units: d.units,
      p_foto: d.foto,
    });
    if (error) return { ok: false, error: dbErrorMessage(error) };
    refresh();
    return { ok: true, message: "Pengembalian tersimpan. Peminjaman selesai." };
  });
}
