import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { STATUS_PEMINJAMAN } from "@/lib/labels";
import { getPeminjaman } from "@/lib/peminjaman";
import { PemasanganForm } from "../kejadian-forms";
import { RingkasanPeminjaman } from "../ringkasan-peminjaman";

export const metadata: Metadata = { title: "Validasi Pemasangan" };

export default async function PemasanganPage({ params }: PageProps<"/peminjaman/[id]/pemasangan">) {
  await requirePermission("pemasangan.create");
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) notFound();
  const p = await getPeminjaman(pid);
  if (!p) notFound();

  const bisa = (p.status === "diajukan" || p.status === "terlambat") && !p.terpasang;

  return (
    <>
      <PageHeader
        back={{ href: "/", label: "Kembali ke Dashboard" }}
        title={`Validasi Pemasangan · ${p.kode}`}
        description="Tes alat, pasang di lokasi, lalu foto tiap unit"
      />
      {!bisa ? (
        <Alert tone="warning">
          Pemasangan hanya untuk peminjaman yang unitnya belum dipasang. Status sekarang:{" "}
          {STATUS_PEMINJAMAN[p.status].label}.
        </Alert>
      ) : (
        <div className="space-y-3 lg:space-y-4">
          {p.status === "terlambat" && (
            <Alert tone="danger">Rencana kembali sudah lewat, tetapi unit belum dipasang.</Alert>
          )}
          <RingkasanPeminjaman p={p} />
          <PemasanganForm peminjamanId={p.id} units={p.units} />
        </div>
      )}
    </>
  );
}
