import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PEMINJAMAN_ROW_SELECT, PeminjamanTable, toPeminjamanRow } from "@/components/peminjaman-table";
import { requirePermission } from "@/lib/auth";
import { STATUS_PEMINJAMAN_LIST, type StatusPeminjaman } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { RiwayatFilters } from "./riwayat-filters";
import { RiwayatPagination } from "./riwayat-pagination";

export const metadata: Metadata = { title: "Riwayat Peminjaman" };

const PER_HALAMAN = 20;

function one(v: string | string[] | undefined) {
  return typeof v === "string" ? v : undefined;
}

function tanggalValid(v: string | undefined) {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : undefined;
}

/** Awal hari (WITA) → ISO UTC. */
function awalHariWita(tgl: string, tambahHari = 0) {
  const d = new Date(`${tgl}T00:00:00+08:00`);
  d.setUTCDate(d.getUTCDate() + tambahHari);
  return d.toISOString();
}

export default async function RiwayatPage({ searchParams }: PageProps<"/riwayat">) {
  await requirePermission("riwayat.view");
  const sp = await searchParams;

  const q = one(sp.q)?.trim().slice(0, 60) ?? "";
  const status = STATUS_PEMINJAMAN_LIST.find((s) => s === one(sp.status)) as StatusPeminjaman | undefined;
  const dari = tanggalValid(one(sp.dari));
  const sampai = tanggalValid(one(sp.sampai));
  const halaman = Math.max(1, Number(one(sp.halaman)) || 1);

  const supabase = await createClient();

  // Pencarian kode aset: cari dulu peminjaman yang memuat aset tersebut.
  const safe = q.replace(/[%,()*\\]/g, " ").trim();
  let idDariAset: number[] = [];
  if (safe) {
    const { data } = await supabase
      .from("detail_peminjaman")
      .select("peminjaman_id, aset!inner(kode_aset)")
      .ilike("aset.kode_aset", `%${safe}%`)
      .limit(500);
    idDariAset = [...new Set((data ?? []).map((d) => d.peminjaman_id))];
  }

  let query = supabase
    .from("peminjaman")
    .select(PEMINJAMAN_ROW_SELECT, { count: "exact" })
    .order("tgl_peminjaman", { ascending: false })
    .order("id", { ascending: false });

  if (safe) {
    const kondisi = [
      `kode_peminjaman.ilike.%${safe}%`,
      `nama_peminjam.ilike.%${safe}%`,
      `divisi_peminjam.ilike.%${safe}%`,
    ];
    if (idDariAset.length) kondisi.push(`id.in.(${idDariAset.join(",")})`);
    query = query.or(kondisi.join(","));
  }
  if (status) query = query.eq("status", status);
  if (dari) query = query.gte("tgl_peminjaman", awalHariWita(dari));
  if (sampai) query = query.lt("tgl_peminjaman", awalHariWita(sampai, 1));

  const from = (halaman - 1) * PER_HALAMAN;
  const { data, count, error } = await query.range(from, from + PER_HALAMAN - 1);
  if (error && error.code !== "PGRST103") throw new Error(error.message); // PGRST103: halaman di luar jangkauan

  const total = count ?? 0;
  const totalHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN));

  return (
    <>
      <PageHeader title="Riwayat Peminjaman" description="Semua peminjaman, termasuk yang dibatalkan dan selesai." />
      <RiwayatFilters value={{ q, status: status ?? "", dari: dari ?? "", sampai: sampai ?? "" }} />
      <p className="mb-3 text-sm text-gray-500">
        {total === 0
          ? "Tidak ada peminjaman yang cocok."
          : `Menampilkan ${from + 1}–${Math.min(from + PER_HALAMAN, total)} dari ${total} peminjaman`}
      </p>
      <PeminjamanTable rows={(data ?? []).map(toPeminjamanRow)} empty="Tidak ada peminjaman yang cocok." />
      {totalHalaman > 1 && <RiwayatPagination halaman={Math.min(halaman, totalHalaman)} totalHalaman={totalHalaman} />}
    </>
  );
}
