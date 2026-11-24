import "server-only";
import { STATUS_PEMINJAMAN_LIST, type StatusPeminjaman } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

/** Filter riwayat dari query string (dipakai halaman Riwayat dan ekspor rekap). */
export type FilterRiwayat = {
  q: string;
  status?: StatusPeminjaman;
  /** yyyy-MM-dd (WITA), berdasarkan tanggal keluar */
  dari?: string;
  sampai?: string;
};

type Sp = Record<string, string | string[] | undefined> | URLSearchParams;

function ambil(sp: Sp, key: string) {
  const v = sp instanceof URLSearchParams ? sp.get(key) ?? undefined : sp[key];
  return typeof v === "string" ? v : undefined;
}

function tanggalValid(v: string | undefined) {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : undefined;
}

export function parseFilterRiwayat(sp: Sp): FilterRiwayat {
  return {
    q: ambil(sp, "q")?.trim().slice(0, 60) ?? "",
    status: STATUS_PEMINJAMAN_LIST.find((s) => s === ambil(sp, "status")),
    dari: tanggalValid(ambil(sp, "dari")),
    sampai: tanggalValid(ambil(sp, "sampai")),
  };
}

/** Awal hari (WITA) → ISO UTC. */
export function awalHariWita(tgl: string, tambahHari = 0) {
  const d = new Date(`${tgl}T00:00:00+08:00`);
  d.setUTCDate(d.getUTCDate() + tambahHari);
  return d.toISOString();
}

/**
 * Kondisi pencarian teks untuk `.or()` (kode, nama, divisi, kode aset), atau null bila tidak mencari.
 * Pencarian kode aset: cari dulu peminjaman yang memuat aset tersebut.
 */
export async function kondisiCari(q: string): Promise<string | null> {
  const safe = q.replace(/[%,()*\\]/g, " ").trim();
  if (!safe) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("detail_peminjaman")
    .select("peminjaman_id, aset!inner(kode_aset)")
    .ilike("aset.kode_aset", `%${safe}%`)
    .limit(500);
  const idDariAset = [...new Set((data ?? []).map((d) => d.peminjaman_id))];
  const kondisi = [
    `kode_peminjaman.ilike.%${safe}%`,
    `nama_peminjam.ilike.%${safe}%`,
    `divisi_peminjam.ilike.%${safe}%`,
  ];
  if (idDariAset.length) kondisi.push(`id.in.(${idDariAset.join(",")})`);
  return kondisi.join(",");
}
