import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Alert,
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
import { formatWita, menitSejak } from "@/lib/datetime";
import { KONDISI, STATUS_PEMINJAMAN } from "@/lib/labels";
import { getPeminjaman } from "@/lib/peminjaman";
import { AksiPeminjaman } from "./aksi-peminjaman";
import { Timeline } from "./timeline";

export const metadata: Metadata = { title: "Detail Peminjaman" };

export default async function DetailPeminjamanPage({ params, searchParams }: PageProps<"/peminjaman/[id]">) {
  const user = await requirePermission("peminjaman.view");
  const { id } = await params;
  const { baru } = await searchParams;
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) notFound();

  await connection(); // waktu "sekarang" dihitung saat request
  const p = await getPeminjaman(pid);
  if (!p) notFound();

  const st = STATUS_PEMINJAMAN[p.status];
  const terlambatMenit = p.status === "terlambat" ? menitSejak(p.tglRencanaKembali) : 0;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm text-gray-500">Detail Peminjaman</p>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-gray-900">{p.kode}</h1>
            <Badge color={st.color} size="sm">{st.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Dicatat oleh {p.dicatatOleh} · {formatWita(p.createdAt)}
          </p>
        </div>
        <AksiPeminjaman
          id={p.id}
          kode={p.kode}
          status={p.status}
          tglRencanaKembali={p.tglRencanaKembali}
          can={{
            pemasangan: user.permissions.includes("pemasangan.create"),
            pengembalian: user.permissions.includes("pengembalian.create"),
            extend: user.permissions.includes("peminjaman.extend"),
            cancel: user.permissions.includes("peminjaman.cancel"),
          }}
        />
      </div>

      {baru === "1" && (
        <Alert color="success" className="mb-4">
          Peminjaman {p.kode} tersimpan dengan status Diajukan. Petugas Sarpras sudah diberi notifikasi.
        </Alert>
      )}
      {p.status === "terlambat" && (
        <Alert color="failure" className="mb-4">
          Terlambat {formatDurasi(terlambatMenit)} dari rencana kembali {formatWita(p.tglRencanaKembali)}.
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <h2 className="text-base font-semibold text-gray-900">Informasi Peminjam</h2>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Info label="Nama peminjam" value={p.namaPeminjam} />
              <Info label="Nomor kontak" value={p.kontak} />
              <Info label="Divisi" value={p.divisi} />
              <Info label="Ruangan" value={p.ruangan} />
              <Info label="Tanggal keluar" value={formatWita(p.tglPeminjaman)} />
              <Info label="Rencana kembali" value={formatWita(p.tglRencanaKembali)} />
              <div className="sm:col-span-2">
                <Info label="Keperluan" value={p.keperluan} />
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-gray-900">Unit ({p.units.length})</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeadCell>Kode</TableHeadCell>
                    <TableHeadCell>Nama Barang</TableHeadCell>
                    <TableHeadCell>Kategori</TableHeadCell>
                    <TableHeadCell>Kondisi Keluar</TableHeadCell>
                    <TableHeadCell>Kondisi Masuk</TableHeadCell>
                    <TableHeadCell>Catatan</TableHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody className="divide-y">
                  {p.units.map((u) => (
                    <TableRow key={u.detailId} className="bg-white">
                      <TableCell className="font-mono font-medium">
                        <Link href={`/aset/${u.asetId}`} className="text-cyan-700 hover:underline">
                          {u.kodeAset}
                        </Link>
                      </TableCell>
                      <TableCell>{u.namaAset}</TableCell>
                      <TableCell>{u.kategoriNama}</TableCell>
                      <TableCell>
                        {u.kondisiKeluar ? (
                          <Badge color={KONDISI[u.kondisiKeluar].color} className="w-fit">{KONDISI[u.kondisiKeluar].label}</Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.kondisiMasuk ? (
                          <Badge color={KONDISI[u.kondisiMasuk].color} className="w-fit">{KONDISI[u.kondisiMasuk].label}</Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-pre-line text-xs">{u.catatan ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Foto pemasangan / pengembalian ditambahkan pada Fase 5 */}
        </div>

        <div className="space-y-6">
          {(p.sebelumnya || p.sesudahnya) && (
            <Card>
              <h2 className="text-base font-semibold text-gray-900">Rantai Perpanjangan</h2>
              <ol className="space-y-2 text-sm">
                {p.sebelumnya && (
                  <li>
                    <span className="text-gray-500">Perpanjangan dari </span>
                    <Link href={`/peminjaman/${p.sebelumnya.id}`} className="font-mono font-medium text-cyan-700 hover:underline">
                      {p.sebelumnya.kode_peminjaman}
                    </Link>
                  </li>
                )}
                {p.sesudahnya && (
                  <li>
                    <span className="text-gray-500">Diperpanjang menjadi </span>
                    <Link href={`/peminjaman/${p.sesudahnya.id}`} className="font-mono font-medium text-cyan-700 hover:underline">
                      {p.sesudahnya.kode_peminjaman}
                    </Link>
                    <Badge color={STATUS_PEMINJAMAN[p.sesudahnya.status].color} className="ms-2 inline-flex">
                      {STATUS_PEMINJAMAN[p.sesudahnya.status].label}
                    </Badge>
                  </li>
                )}
              </ol>
            </Card>
          )}

          <Card>
            <h2 className="text-base font-semibold text-gray-900">Timeline</h2>
            <Timeline log={p.log} />
          </Card>
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium whitespace-pre-line text-gray-900">{value}</dd>
    </div>
  );
}

function formatDurasi(menit: number) {
  const hari = Math.floor(menit / 1440);
  const jam = Math.floor((menit % 1440) / 60);
  const m = menit % 60;
  return [hari && `${hari} hari`, jam && `${jam} jam`, `${m} menit`].filter(Boolean).join(" ");
}
