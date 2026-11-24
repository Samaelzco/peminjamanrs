import "server-only";
import type { StatusPeminjaman } from "@/lib/labels";
import { awalHariWita, kondisiCari, type FilterRiwayat } from "@/lib/riwayat-filter";
import { createClient } from "@/lib/supabase/server";

const HALAMAN_DB = 1000; // batas baris per permintaan PostgREST

export type BarisRekap = {
  kode: string;
  status: StatusPeminjaman;
  namaPeminjam: string;
  divisi: string;
  kontak: string;
  ruangan: string;
  keperluan: string;
  units: { kode: string; nama: string; kategori: string; kondisiMasuk: string | null }[];
  tglKeluar: Date;
  rencanaKembali: Date;
  tglPasang: Date | null;
  /** Waktu peminjaman berakhir: pengembalian, atau saat ditutup (perpanjangan/manual/batal). */
  tglSelesai: Date | null;
  caraSelesai: string;
  perpanjanganDari: string | null;
  pernahTerlambat: boolean;
  /** Lama terlambat (menit); untuk yang masih berjalan dihitung sampai saat ekspor. */
  menitTerlambat: number;
};

/** Ambil semua peminjaman sesuai filter riwayat, lengkap dengan perhitungan keterlambatan. */
export async function ambilRekap(filter: FilterRiwayat, sekarang = new Date()): Promise<BarisRekap[]> {
  const supabase = await createClient();
  const cari = await kondisiCari(filter.q);

  const mentah = [];
  for (let from = 0; ; from += HALAMAN_DB) {
    let query = supabase
      .from("peminjaman")
      .select(
        `id, kode_peminjaman, status, nama_peminjam, divisi_peminjam, kontak_peminjam, ruangan, keperluan,
         tgl_peminjaman, tgl_rencana_kembali, perpanjangan_dari,
         detail_peminjaman ( kondisi_masuk, aset ( kode_aset, nama_aset, kategori ( nama ) ) ),
         pemasangan ( tgl_pemasangan ),
         pengembalian ( tgl_kembali ),
         log_peminjaman ( status_lama, status_baru, keterangan, created_at )`,
      )
      .order("tgl_peminjaman")
      .order("id");
    if (cari) query = query.or(cari);
    if (filter.status) query = query.eq("status", filter.status);
    if (filter.dari) query = query.gte("tgl_peminjaman", awalHariWita(filter.dari));
    if (filter.sampai) query = query.lt("tgl_peminjaman", awalHariWita(filter.sampai, 1));

    const { data, error } = await query.range(from, from + HALAMAN_DB - 1);
    if (error) throw new Error(error.message);
    mentah.push(...(data ?? []));
    if (!data || data.length < HALAMAN_DB) break;
  }

  // Kode peminjaman asal perpanjangan (bisa di luar rentang filter).
  const idAsal = [...new Set(mentah.map((p) => p.perpanjangan_dari).filter((x): x is number => x !== null))];
  const kodeAsal = new Map<number, string>();
  if (idAsal.length) {
    const { data } = await supabase.from("peminjaman").select("id, kode_peminjaman").in("id", idAsal);
    for (const p of data ?? []) kodeAsal.set(p.id, p.kode_peminjaman);
  }

  return mentah.map((p) => {
    const rencana = new Date(p.tgl_rencana_kembali);
    const log = [...p.log_peminjaman].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const logAkhir = [...log].reverse().find((l) => l.status_baru === p.status && l.status_lama !== l.status_baru);

    let tglSelesai: Date | null = null;
    let caraSelesai = "-";
    if (p.pengembalian) {
      tglSelesai = new Date(p.pengembalian.tgl_kembali);
      caraSelesai = "Dikembalikan";
    } else if (p.status === "selesai" || p.status === "dibatalkan") {
      tglSelesai = logAkhir ? new Date(logAkhir.created_at) : null;
      caraSelesai =
        p.status === "dibatalkan"
          ? "Dibatalkan"
          : logAkhir?.keterangan?.includes("diperpanjang")
            ? "Diperpanjang"
            : "Ditutup manual";
    }

    const pernahTerlambat =
      log.some((l) => l.status_baru === "terlambat") || (tglSelesai !== null && caraSelesai !== "Dibatalkan" && tglSelesai > rencana);
    const akhir = tglSelesai ?? sekarang;
    const menitTerlambat =
      pernahTerlambat && caraSelesai !== "Dibatalkan"
        ? Math.max(0, Math.round((akhir.getTime() - rencana.getTime()) / 60000))
        : 0;

    return {
      kode: p.kode_peminjaman,
      status: p.status,
      namaPeminjam: p.nama_peminjam,
      divisi: p.divisi_peminjam,
      kontak: p.kontak_peminjam,
      ruangan: p.ruangan,
      keperluan: p.keperluan,
      units: p.detail_peminjaman
        .map((d) => ({
          kode: d.aset?.kode_aset ?? "-",
          nama: d.aset?.nama_aset ?? "-",
          kategori: d.aset?.kategori?.nama ?? "-",
          kondisiMasuk: d.kondisi_masuk,
        }))
        .sort((a, b) => a.kode.length - b.kode.length || a.kode.localeCompare(b.kode)),
      tglKeluar: new Date(p.tgl_peminjaman),
      rencanaKembali: rencana,
      tglPasang: p.pemasangan ? new Date(p.pemasangan.tgl_pemasangan) : null,
      tglSelesai,
      caraSelesai,
      perpanjanganDari: p.perpanjangan_dari ? kodeAsal.get(p.perpanjangan_dari) ?? null : null,
      pernahTerlambat,
      menitTerlambat,
    };
  });
}

/** 1 hari 3 jam 5 menit */
export function formatDurasi(menit: number) {
  if (menit <= 0) return "-";
  const hari = Math.floor(menit / 1440);
  const jam = Math.floor((menit % 1440) / 60);
  const m = menit % 60;
  return [hari && `${hari} hari`, jam && `${jam} jam`, m && `${m} menit`].filter(Boolean).join(" ") || "0 menit";
}
