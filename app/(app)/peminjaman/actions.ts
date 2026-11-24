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
import { BATAS, namaOrang, nomorKontak, teks } from "@/lib/validation";

const HARI_MS = 24 * 3600_000;
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
        jumlah: z.coerce
          .number("Jumlah harus angka.")
          .int("Jumlah harus bilangan bulat.")
          .min(1, "Jumlah minimal 1.")
          .max(BATAS.jumlahUnitMax, `Jumlah maksimal ${BATAS.jumlahUnitMax}.`),
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

/** Tanggal WITA (yyyy-MM-ddTHH:mm) → ISO; tambahkan issue bila tidak valid. */
function keIso(v: string, ctx: z.RefinementCtx, path: string): string {
  try {
    return witaInputToIso(v);
  } catch {
    ctx.addIssue({ code: "custom", message: "Tanggal/jam tidak valid. Format: dd/mm/yyyy jj:mm.", path: [path] });
    return z.NEVER;
  }
}

const dataPeminjamSchema = z.object({
  nama_peminjam: namaOrang("Nama peminjam"),
  kontak_peminjam: nomorKontak,
  divisi_peminjam: teks("Divisi", BATAS.divisi),
  ruangan: teks("Ruangan", BATAS.ruangan),
  keperluan: teks("Keperluan", BATAS.keperluan),
  aset_ids: z.array(idSchema).min(1, "Tambahkan minimal satu unit.").max(200),
});

// Jadwal divalidasi terpisah supaya error tanggal tetap tampil walaupun kolom lain juga salah
// (refinement zod tidak berjalan bila objek yang sama sudah punya error).
const jadwalSchema = z
  .object({
    tgl_peminjaman: z.string().min(1, "Tanggal keluar wajib diisi."),
    tgl_rencana_kembali: z.string().min(1, "Tanggal rencana kembali wajib diisi."),
  })
  .transform((v, ctx) => ({
    tgl_peminjaman: keIso(v.tgl_peminjaman, ctx, "tgl_peminjaman"),
    tgl_rencana_kembali: keIso(v.tgl_rencana_kembali, ctx, "tgl_rencana_kembali"),
  }))
  .superRefine((v, ctx) => {
    const keluar = new Date(v.tgl_peminjaman).getTime();
    const kembali = new Date(v.tgl_rencana_kembali).getTime();
    if (keluar < Date.now() - BATAS.mundurMaksHari * HARI_MS) {
      ctx.addIssue({
        code: "custom",
        path: ["tgl_peminjaman"],
        message: `Tanggal keluar paling lama ${BATAS.mundurMaksHari} hari ke belakang.`,
      });
    }
    if (kembali <= keluar) {
      ctx.addIssue({ code: "custom", path: ["tgl_rencana_kembali"], message: "Rencana kembali harus setelah tanggal keluar." });
    } else if (kembali - keluar > BATAS.durasiMaksHari * HARI_MS) {
      ctx.addIssue({
        code: "custom",
        path: ["tgl_rencana_kembali"],
        message: `Lama peminjaman maksimal ${BATAS.durasiMaksHari} hari.`,
      });
    }
  });

type PeminjamanInputData = z.input<typeof dataPeminjamSchema> & z.input<typeof jadwalSchema>;

export type PeminjamanInput = PeminjamanInputData;

export async function buatPeminjaman(input: PeminjamanInput): Promise<ActionResult> {
  const result = await runAction<{ id: number }>(async () => {
    await authorize("peminjaman.create");
    const dataP = dataPeminjamSchema.safeParse(input);
    const jadwal = jadwalSchema.safeParse(input);
    if (!dataP.success || !jadwal.success) {
      const issues = [...(dataP.error?.issues ?? []), ...(jadwal.error?.issues ?? [])];
      return validationError(new z.ZodError(issues));
    }
    const d = { ...dataP.data, ...jadwal.data };

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
    const cek = z.string().trim().max(BATAS.alasan, `Alasan maksimal ${BATAS.alasan} karakter.`).safeParse(alasan ?? "");
    if (!cek.success) return { ok: false, error: cek.error.issues[0].message };
    const alasanBersih = cek.data;

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

const perpanjangSchema = z.object({
  peminjamanId: idSchema,
  tgl_rencana_kembali: z.string().min(1, "Tanggal rencana kembali baru wajib diisi."),
  alasan: teks("Alasan perpanjangan", BATAS.alasan),
});

export async function perpanjangPeminjaman(input: z.input<typeof perpanjangSchema>): Promise<ActionResult> {
  const result = await runAction<{ id: number }>(async () => {
    await authorize("peminjaman.extend");
    const parsed = perpanjangSchema.safeParse(input);
    // Cek tanggal terpisah supaya error tanggal & alasan tampil bersamaan.
    const errTgl: string[] = [];
    let tgl = "";
    try {
      tgl = witaInputToIso(String(input?.tgl_rencana_kembali ?? ""));
      const t = new Date(tgl).getTime();
      if (t <= Date.now()) errTgl.push("Rencana kembali baru harus setelah waktu sekarang.");
      else if (t > Date.now() + BATAS.durasiMaksHari * HARI_MS) {
        errTgl.push(`Perpanjangan maksimal ${BATAS.durasiMaksHari} hari dari sekarang.`);
      }
    } catch {
      errTgl.push("Tanggal/jam tidak valid. Format: dd/mm/yyyy jj:mm.");
    }
    if (!parsed.success || errTgl.length) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error?.issues ?? []) (fieldErrors[issue.path.join(".")] ??= []).push(issue.message);
      if (errTgl.length) fieldErrors.tgl_rencana_kembali = errTgl;
      return { ok: false, error: "Periksa kembali isian Anda.", fieldErrors };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("perpanjang_peminjaman", {
      p_peminjaman_id: parsed.data.peminjamanId,
      p_tgl_rencana_kembali: tgl,
      p_alasan: parsed.data.alasan,
    });
    if (error || !data?.[0]) return { ok: false, error: error ? dbErrorMessage(error) : "Gagal memperpanjang." };
    return { ok: true, data: { id: data[0].id } };
  });

  if (result.ok && result.data) redirect(`/peminjaman/${result.data.id}?perpanjangan=1`);
  return result.ok ? { ok: true } : result;
}
