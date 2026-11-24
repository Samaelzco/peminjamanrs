import Link from "next/link";
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from "flowbite-react";
import { formatWita } from "@/lib/datetime";
import { STATUS_PEMINJAMAN, type StatusPeminjaman } from "@/lib/labels";

export type PeminjamanRow = {
  id: number;
  kode: string;
  status: StatusPeminjaman;
  namaPeminjam: string;
  divisi: string;
  ruangan: string;
  tglPeminjaman: string;
  tglRencanaKembali: string;
  units: string[];
};

/** Kolom select Supabase yang cocok dengan toPeminjamanRow. */
export const PEMINJAMAN_ROW_SELECT =
  "id, kode_peminjaman, status, nama_peminjam, divisi_peminjam, ruangan, tgl_peminjaman, tgl_rencana_kembali, detail_peminjaman(aset(kode_aset))";

type RawRow = {
  id: number;
  kode_peminjaman: string;
  status: StatusPeminjaman;
  nama_peminjam: string;
  divisi_peminjam: string;
  ruangan: string;
  tgl_peminjaman: string;
  tgl_rencana_kembali: string;
  detail_peminjaman: { aset: { kode_aset: string } | null }[];
};

export function toPeminjamanRow(r: RawRow): PeminjamanRow {
  return {
    id: r.id,
    kode: r.kode_peminjaman,
    status: r.status,
    namaPeminjam: r.nama_peminjam,
    divisi: r.divisi_peminjam,
    ruangan: r.ruangan,
    tglPeminjaman: r.tgl_peminjaman,
    tglRencanaKembali: r.tgl_rencana_kembali,
    units: r.detail_peminjaman
      .map((d) => d.aset?.kode_aset ?? "")
      .filter(Boolean)
      .sort((a, b) => a.length - b.length || a.localeCompare(b)),
  };
}

export function PeminjamanTable({ rows, empty = "Tidak ada data." }: { rows: PeminjamanRow[]; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <Table hoverable>
        <TableHead>
          <TableRow>
            <TableHeadCell>Kode</TableHeadCell>
            <TableHeadCell>Peminjam</TableHeadCell>
            <TableHeadCell>Ruangan</TableHeadCell>
            <TableHeadCell>Unit</TableHeadCell>
            <TableHeadCell>Keluar</TableHeadCell>
            <TableHeadCell>Rencana Kembali</TableHeadCell>
            <TableHeadCell>Status</TableHeadCell>
          </TableRow>
        </TableHead>
        <TableBody className="divide-y">
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-6 text-center text-gray-500">{empty}</TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id} className="bg-white">
              <TableCell className="font-mono font-medium whitespace-nowrap">
                <Link href={`/peminjaman/${r.id}`} className="text-cyan-700 hover:underline">{r.kode}</Link>
              </TableCell>
              <TableCell>
                <p className="text-gray-900">{r.namaPeminjam}</p>
                <p className="text-xs text-gray-500">{r.divisi}</p>
              </TableCell>
              <TableCell>{r.ruangan}</TableCell>
              <TableCell className="max-w-[14rem] font-mono text-xs">{r.units.join(", ")}</TableCell>
              <TableCell className="whitespace-nowrap">{formatWita(r.tglPeminjaman)}</TableCell>
              <TableCell className={`whitespace-nowrap ${r.status === "terlambat" ? "font-semibold text-red-600" : ""}`}>
                {formatWita(r.tglRencanaKembali)}
              </TableCell>
              <TableCell>
                <Badge color={STATUS_PEMINJAMAN[r.status].color} className="w-fit">{STATUS_PEMINJAMAN[r.status].label}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
