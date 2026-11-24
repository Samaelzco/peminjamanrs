import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Alert, Card } from "flowbite-react";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth";
import { formatWita, toWitaInput } from "@/lib/datetime";
import { STATUS_PEMINJAMAN } from "@/lib/labels";
import { getPeminjaman } from "@/lib/peminjaman";
import { PerpanjangForm } from "./perpanjang-form";

export const metadata: Metadata = { title: "Perpanjang Peminjaman" };

export default async function PerpanjangPage({ params }: PageProps<"/peminjaman/[id]/perpanjang">) {
  await requirePermission("peminjaman.extend");
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) notFound();
  const p = await getPeminjaman(pid);
  if (!p) notFound();

  await connection();
  const lama = new Date(p.tglRencanaKembali).getTime();
  const usul = new Date(Math.max(lama, new Date().getTime()) + 24 * 3600_000);
  usul.setSeconds(0, 0);

  const bisa = p.status === "dipinjam" || p.status === "terlambat";

  return (
    <>
      <Link href={`/peminjaman/${p.id}`} className="mb-2 inline-block text-sm text-cyan-700 hover:underline">
        ← Kembali ke {p.kode}
      </Link>
      <PageHeader
        title={`Perpanjang ${p.kode}`}
        description="Perpanjangan membuat peminjaman baru (langsung Dipinjam, tanpa pemasangan ulang). Peminjaman lama ditutup menjadi Selesai."
      />
      {!bisa ? (
        <Alert color="warning">
          Perpanjangan hanya untuk peminjaman berstatus Dipinjam atau Terlambat. Status sekarang:{" "}
          {STATUS_PEMINJAMAN[p.status].label}.
        </Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="text-base font-semibold text-gray-900">Peminjaman Saat Ini</h2>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-gray-500">Peminjam</dt><dd className="font-medium">{p.namaPeminjam} · {p.divisi}</dd></div>
              <div><dt className="text-gray-500">Ruangan</dt><dd className="font-medium">{p.ruangan}</dd></div>
              <div><dt className="text-gray-500">Rencana kembali</dt><dd className="font-medium">{formatWita(p.tglRencanaKembali)}</dd></div>
              <div>
                <dt className="text-gray-500">Unit ({p.units.length})</dt>
                <dd className="font-mono font-medium">{p.units.map((u) => u.kodeAset).join(", ")}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <h2 className="text-base font-semibold text-gray-900">Perpanjangan</h2>
            <PerpanjangForm peminjamanId={p.id} defaultTanggal={toWitaInput(usul)} />
          </Card>
        </div>
      )}
    </>
  );
}
