import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from "flowbite-react";
import { requirePermission } from "@/lib/auth";
import { formatWita } from "@/lib/datetime";
import { KONDISI, STATUS_ASET, STATUS_PEMINJAMAN } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Detail Aset" };

export default async function AsetDetailPage({ params }: PageProps<"/aset/[id]">) {
  const user = await requirePermission("aset.view");
  const { id } = await params;
  const asetId = Number(id);
  if (!Number.isInteger(asetId) || asetId <= 0) notFound();

  const supabase = await createClient();
  const { data: aset } = await supabase
    .from("aset")
    .select("id, kode_aset, nama_aset, deskripsi, kondisi, status, created_at, kategori(nama)")
    .eq("id", asetId)
    .maybeSingle();
  if (!aset) notFound();

  const bisaLihatPeminjaman =
    user.permissions.includes("peminjaman.view") || user.permissions.includes("riwayat.view");
  const { data: riwayat } = bisaLihatPeminjaman
    ? await supabase
        .from("detail_peminjaman")
        .select(
          "id, kondisi_keluar, kondisi_masuk, catatan, peminjaman!inner(id, kode_peminjaman, status, nama_peminjam, divisi_peminjam, tgl_peminjaman, tgl_rencana_kembali)",
        )
        .eq("aset_id", asetId)
        .order("peminjaman(tgl_peminjaman)", { ascending: false })
    : { data: [] };

  return (
    <>
      <Link href="/aset" className="mb-2 inline-block text-sm text-cyan-700 hover:underline">
        ← Kembali ke Data Aset
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-bold text-gray-900">{aset.kode_aset}</h1>
        <Badge color={STATUS_ASET[aset.status].color} size="sm">{STATUS_ASET[aset.status].label}</Badge>
        <Badge color={KONDISI[aset.kondisi].color} size="sm">Kondisi {KONDISI[aset.kondisi].label}</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <h2 className="text-base font-semibold text-gray-900">Informasi Aset</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-gray-500">Nama aset</dt><dd className="font-medium">{aset.nama_aset}</dd></div>
            <div><dt className="text-gray-500">Kategori</dt><dd className="font-medium">{aset.kategori?.nama}</dd></div>
            <div><dt className="text-gray-500">Deskripsi</dt><dd className="font-medium whitespace-pre-line">{aset.deskripsi ?? "-"}</dd></div>
            <div><dt className="text-gray-500">Terdaftar</dt><dd className="font-medium">{formatWita(aset.created_at)}</dd></div>
          </dl>
        </Card>

        <Card className="xl:col-span-2">
          <h2 className="text-base font-semibold text-gray-900">Riwayat Peminjaman</h2>
          {!bisaLihatPeminjaman ? (
            <p className="text-sm text-gray-500">Anda tidak punya izin melihat peminjaman.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeadCell>Kode</TableHeadCell>
                    <TableHeadCell>Peminjam</TableHeadCell>
                    <TableHeadCell>Keluar</TableHeadCell>
                    <TableHeadCell>Rencana Kembali</TableHeadCell>
                    <TableHeadCell>Status</TableHeadCell>
                    <TableHeadCell>Kondisi</TableHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody className="divide-y">
                  {(riwayat ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500">Belum pernah dipinjam.</TableCell>
                    </TableRow>
                  )}
                  {(riwayat ?? []).map((r) => (
                    <TableRow key={r.id} className="bg-white">
                      <TableCell className="font-mono">
                        <Link href={`/peminjaman/${r.peminjaman.id}`} className="text-cyan-700 hover:underline">
                          {r.peminjaman.kode_peminjaman}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <p className="text-gray-900">{r.peminjaman.nama_peminjam}</p>
                        <p className="text-xs text-gray-500">{r.peminjaman.divisi_peminjam}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatWita(r.peminjaman.tgl_peminjaman)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatWita(r.peminjaman.tgl_rencana_kembali)}</TableCell>
                      <TableCell>
                        <Badge color={STATUS_PEMINJAMAN[r.peminjaman.status].color} className="w-fit">
                          {STATUS_PEMINJAMAN[r.peminjaman.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.kondisi_keluar ? `Keluar: ${KONDISI[r.kondisi_keluar].label}` : ""}
                        {r.kondisi_masuk ? ` · Masuk: ${KONDISI[r.kondisi_masuk].label}` : ""}
                        {!r.kondisi_keluar && !r.kondisi_masuk && "-"}
                        {r.catatan && <p className="text-gray-500">{r.catatan}</p>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
