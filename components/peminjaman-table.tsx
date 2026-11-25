import Link from "next/link";
import type { ReactNode } from "react";
import { LuChevronRight } from "react-icons/lu";
import { EmptyState, Pill, cn } from "@/components/ui";
import { formatRingkas, formatTanggal } from "@/lib/datetime";
import { STATUS_PEMINJAMAN, type StatusPeminjaman } from "@/lib/labels";

export type PeminjamanRow = {
  id: number;
  kode: string;
  status: StatusPeminjaman;
  namaPeminjam: string;
  kontak: string;
  divisi: string;
  ruangan: string;
  tglPeminjaman: string;
  tglRencanaKembali: string;
  tglKembali: string | null;
  terpasang: boolean;
  units: string[];
  /** Ringkasan barang per kategori, contoh "Proyektor, Speaker ×2". */
  barang: string;
  pasangStaffId: string | null;
  kembaliStaffId: string | null;
};

/** Kolom select Supabase yang cocok dengan toPeminjamanRow. */
export const PEMINJAMAN_ROW_SELECT =
  "id, kode_peminjaman, status, nama_peminjam, kontak_peminjam, divisi_peminjam, ruangan, tgl_peminjaman, tgl_rencana_kembali, perpanjangan_dari, detail_peminjaman(aset(kode_aset, kategori(nama))), pemasangan(id, staff_id), pengembalian(tgl_kembali, staff_id)";

type RawRow = {
  id: number;
  kode_peminjaman: string;
  status: StatusPeminjaman;
  nama_peminjam: string;
  kontak_peminjam: string;
  divisi_peminjam: string;
  ruangan: string;
  tgl_peminjaman: string;
  tgl_rencana_kembali: string;
  perpanjangan_dari: number | null;
  detail_peminjaman: { aset: { kode_aset: string; kategori: { nama: string } | null } | null }[];
  pemasangan: { id: number; staff_id: string } | null;
  pengembalian: { tgl_kembali: string; staff_id: string } | null;
};

export function ringkasBarang(namaKategori: string[]) {
  const hitung = new Map<string, number>();
  for (const n of namaKategori) hitung.set(n, (hitung.get(n) ?? 0) + 1);
  return [...hitung].map(([n, j]) => (j > 1 ? `${n} ×${j}` : n)).join(", ");
}

export function toPeminjamanRow(r: RawRow): PeminjamanRow {
  return {
    id: r.id,
    kode: r.kode_peminjaman,
    status: r.status,
    namaPeminjam: r.nama_peminjam,
    kontak: r.kontak_peminjam,
    divisi: r.divisi_peminjam,
    ruangan: r.ruangan,
    tglPeminjaman: r.tgl_peminjaman,
    tglRencanaKembali: r.tgl_rencana_kembali,
    tglKembali: r.pengembalian?.tgl_kembali ?? null,
    // Hasil perpanjangan tidak dipasang ulang.
    terpasang: !!r.pemasangan || r.perpanjangan_dari !== null,
    units: r.detail_peminjaman
      .map((d) => d.aset?.kode_aset ?? "")
      .filter(Boolean)
      .sort((a, b) => a.length - b.length || a.localeCompare(b)),
    pasangStaffId: r.pemasangan?.staff_id ?? null,
    kembaliStaffId: r.pengembalian?.staff_id ?? null,
    barang: ringkasBarang(r.detail_peminjaman.map((d) => d.aset?.kategori?.nama ?? "").filter(Boolean)),
  };
}

export function StatusPill({ status }: { status: StatusPeminjaman }) {
  const s = STATUS_PEMINJAMAN[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

/**
 * Kartu peminjaman. Seluruh kartu bisa diklik (tautan utama pada kode),
 * sedangkan `aksi` tampil di bawah dan tetap bisa difokus sendiri.
 */
export function PeminjamanCard({
  row,
  varian = "aktif",
  aksi,
  meta,
  kanan,
}: {
  row: PeminjamanRow;
  varian?: "aktif" | "riwayat";
  aksi?: ReactNode;
  /** Ganti baris keterangan bawaan. */
  meta?: ReactNode;
  /** Ganti pill status di kanan atas. */
  kanan?: ReactNode;
}) {
  return (
    <li className="group relative rounded-xl border border-gray-200 bg-white p-4 transition-shadow duration-200 hover:shadow-[0_6px_20px_rgba(15,23,42,.06)]">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/peminjaman/${row.id}`}
              className="text-[15px] font-bold text-gray-900 after:absolute after:inset-0 after:rounded-xl focus:outline-none focus-visible:after:outline-3 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand-600"
            >
              {row.kode}
            </Link>
            {kanan ?? <StatusPill status={row.status} />}
          </div>
          <p className="mt-1 text-[15px] break-words text-gray-900">
            {row.namaPeminjam} · {row.divisi}
          </p>
          {meta ?? (
            <div className={cn("mt-1 space-y-1 text-gray-500", varian === "aktif" ? "text-sm" : "text-[13px]")}>
              {varian === "aktif" ? (
                <>
                  <p className="break-words">
                    {row.ruangan} · {row.units.length} unit
                  </p>
                  <p className={cn(row.status === "terlambat" && "font-semibold text-red-800")}>
                    {formatTanggal(row.tglPeminjaman)} → {formatTanggal(row.tglRencanaKembali)}
                  </p>
                </>
              ) : (
                <>
                  <p className="break-words">{row.barang || row.units.join(", ")}</p>
                  <p>
                    Keluar {formatRingkas(row.tglPeminjaman)} · Kembali {formatRingkas(row.tglKembali, false)}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
        {!aksi && (
          <LuChevronRight
            className="mt-9 h-5 w-5 shrink-0 text-gray-500 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden
          />
        )}
      </div>
      {aksi && <div className="relative z-10 mt-3">{aksi}</div>}
    </li>
  );
}

/** "Made Wirawan" → "Made W." (seperti wireframe Riwayat Sarpras). */
export function namaPendek(nama: string | null | undefined) {
  if (!nama) return "—";
  const kata = nama.trim().split(/\s+/);
  return kata.length > 1 ? `${kata[0]} ${kata[kata.length - 1][0]}.` : kata[0];
}

export function PeminjamanList({
  rows,
  empty = "Tidak ada data.",
  varian = "aktif",
  petugas,
}: {
  rows: PeminjamanRow[];
  empty?: string;
  varian?: "aktif" | "riwayat";
  /** Bila diisi (id staf → nama), baris bawah menampilkan petugas pemasangan & pengecekan. */
  petugas?: Record<string, string>;
}) {
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <ul className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => (
        <PeminjamanCard
          key={r.id}
          row={r}
          varian={varian}
          meta={
            petugas ? (
              <div className="mt-1 space-y-1 text-[13px] text-gray-500">
                <p className="break-words">{r.barang || r.units.join(", ")}</p>
                <p>
                  Dipasang oleh {namaPendek(r.pasangStaffId && petugas[r.pasangStaffId])} · Dicek oleh{" "}
                  {namaPendek(r.kembaliStaffId && petugas[r.kembaliStaffId])}
                </p>
              </div>
            ) : undefined
          }
        />
      ))}
    </ul>
  );
}
