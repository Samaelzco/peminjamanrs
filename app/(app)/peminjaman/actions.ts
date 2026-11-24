"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  authorize,
  dbErrorMessage,
  runAction,
  validationError,
  type ActionResult,
} from "@/lib/action";
import { witaInputToIso } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export type UnitTersedia = {
  id: number;
  kode_aset: string;
  nama_aset: string;
  kategori_id: number;
  kategori_nama: string;
};

const idSchema = z.coerce.number().int().positive();
const idsSchema = z.array(idSchema).max(200);

/** + Tambah Unit: ambil N unit tersedia dengan kode terkecil (atau tolak semuanya). */
export async function ambilUnit(
  kategoriId: number,
  jumlah: number,
  kecuali: number[],
): Promise<ActionResult<UnitTersedia[]>> {
  return runAction<UnitTersedia[]>(async () => {
    await authorize("peminjaman.create");
    const parsed = z
      .object({
        kategoriId: idSchema,
        jumlah: z.coerce.number().int("Jumlah harus bilangan bulat.").min(1, "Jumlah minimal 1.").max(50),
        kecuali: idsSchema,
      })
      .safeParse({ kategoriId, jumlah, kecuali });
    if (!parsed.success) return validationError(parsed.error);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("ambil_unit_tersedia", {
      p_kategori_id: parsed.data.kategoriId,
      p_jumlah: parsed.data.jumlah,
      p_kecuali_aset: parsed.data.kecuali,
    });
    if (error) return { ok: false, error: dbErrorMessage(error) };
    return { ok: true, data: data ?? [] };
  });
}

/** Opsi untuk aksi Ganti: unit lain yang tersedia di kategori yang sama. */
export async function opsiGantiUnit(
  kategoriId: number,
  kecuali: number[],
): Promise<ActionResult<UnitTersedia[]>> {
  return runAction<UnitTersedia[]>(async () => {
    await authorize(["peminjaman.create", "pemasangan.create"]);
    const kid = idSchema.parse(kategoriId);
    const ids = idsSchema.parse(kecuali);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("aset_tersedia", { p_kategori_id: kid, p_kecuali_aset: ids });
    if (error) return { ok: false, error: dbErrorMessage(error) };
    return { ok: true, data: data ?? [] };
  });
}

const peminjamanSchema = z
  .object({
    nama_peminjam: z.string().trim().min(1, "Nama peminjam wajib diisi.").max(120),
    kontak_peminjam: z
      .string()
      .trim()
      .min(1, "Nomor kontak wajib diisi.")
      .max(30)
      .regex(/^[0-9+\-\s()]+$/, "Nomor kontak hanya boleh berisi angka, spasi, +, -, ( )."),
    divisi_peminjam: z.string().trim().min(1, "Divisi wajib diisi.").max(120),
    ruangan: z.string().trim().min(1, "Ruangan wajib diisi.").max(120),
    keperluan: z.string().trim().min(1, "Keperluan wajib diisi.").max(500),
    tgl_peminjaman: z.string().min(1, "Tanggal keluar wajib diisi."),
    tgl_rencana_kembali: z.string().min(1, "Tanggal rencana kembali wajib diisi."),
    aset_ids: z.array(idSchema).min(1, "Tambahkan minimal satu unit.").max(200),
  })
  .transform((v, ctx) => {
    try {
      return {
        ...v,
        tgl_peminjaman: witaInputToIso(v.tgl_peminjaman),
        tgl_rencana_kembali: witaInputToIso(v.tgl_rencana_kembali),
      };
    } catch {
      ctx.addIssue({ code: "custom", message: "Format tanggal tidak valid.", path: ["tgl_peminjaman"] });
      return z.NEVER;
    }
  })
  .refine((v) => new Date(v.tgl_rencana_kembali) > new Date(v.tgl_peminjaman), {
    message: "Rencana kembali harus setelah tanggal keluar.",
    path: ["tgl_rencana_kembali"],
  });

export type PeminjamanInput = z.input<typeof peminjamanSchema>;

export async function buatPeminjaman(input: PeminjamanInput): Promise<ActionResult> {
  const result = await runAction<{ id: number }>(async () => {
    await authorize("peminjaman.create");
    const parsed = peminjamanSchema.safeParse(input);
    if (!parsed.success) return validationError(parsed.error);
    const d = parsed.data;

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("buat_peminjaman", {
      p_nama_peminjam: d.nama_peminjam,
      p_divisi_peminjam: d.divisi_peminjam,
      p_kontak_peminjam: d.kontak_peminjam,
      p_ruangan: d.ruangan,
      p_keperluan: d.keperluan,
      p_tgl_peminjaman: d.tgl_peminjaman,
      p_tgl_rencana_kembali: d.tgl_rencana_kembali,
      p_aset_ids: d.aset_ids,
    });
    if (error || !data?.[0]) return { ok: false, error: error ? dbErrorMessage(error) : "Gagal menyimpan." };
    return { ok: true, data: { id: data[0].id } };
  });

  if (result.ok && result.data) redirect(`/peminjaman/${result.data.id}?baru=1`);
  return result.ok ? { ok: true } : result;
}

export async function batalkanPeminjaman(id: number, alasan: string): Promise<ActionResult> {
  return runAction(async () => {
    await authorize("peminjaman.cancel");
    const pid = idSchema.parse(id);
    const alasanBersih = z.string().trim().max(300).parse(alasan ?? "");

    const supabase = await createClient();
    const { error } = await supabase.rpc("batalkan_peminjaman", {
      p_peminjaman_id: pid,
      p_alasan: alasanBersih ? `Dibatalkan: ${alasanBersih}` : "Dibatalkan",
    });
    if (error) return { ok: false, error: dbErrorMessage(error) };

    refresh();
    return { ok: true, message: "Peminjaman dibatalkan. Unit kembali tersedia." };
  });
}
