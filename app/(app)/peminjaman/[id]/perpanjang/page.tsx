import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Alert, Card, CardTitle, InfoNote, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { toWitaInput } from "@/lib/datetime";
import { STATUS_PEMINJAMAN } from "@/lib/labels";
import { getPeminjaman } from "@/lib/peminjaman";
import { RingkasanPeminjaman } from "../ringkasan-peminjaman";
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

  const bisa = (p.status === "dipinjam" || p.status === "terlambat") && p.terpasang;

  return (
    <>
      <PageHeader
        back={{ href: `/peminjaman/${p.id}`, label: `Kembali ke ${p.kode}` }}
        title={`Perpanjang · ${p.kode}`}
        description="Perpanjangan membuat peminjaman baru yang langsung berstatus Dipinjam, tanpa pemasangan ulang."
      />
      {!bisa ? (
        <Alert tone="warning">
          Perpanjangan hanya untuk peminjaman yang sudah dipasang dan berstatus Dipinjam atau Terlambat. Status sekarang:{" "}
          {STATUS_PEMINJAMAN[p.status].label}.
        </Alert>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 lg:items-start lg:gap-4">
          <div className="space-y-3 lg:space-y-4">
            <RingkasanPeminjaman p={p} />
            <Card>
              <CardTitle className="mb-2">Unit ({p.units.length})</CardTitle>
              <ul className="divide-y divide-gray-100 text-sm">
                {p.units.map((u) => (
                  <li key={u.detailId} className="py-2">
                    <span className="font-semibold text-gray-900">{u.kodeAset}</span>
                    <span className="text-gray-500"> · {u.namaAset}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <Card>
            <CardTitle className="mb-3">Perpanjangan</CardTitle>
            <InfoNote className="mb-4">Peminjaman {p.kode} akan ditutup menjadi Selesai setelah diperpanjang.</InfoNote>
            <PerpanjangForm peminjamanId={p.id} defaultTanggal={toWitaInput(usul)} />
          </Card>
        </div>
      )}
    </>
  );
}
