import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "flowbite-react";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth";
import { formatWita } from "@/lib/datetime";
import { STATUS_PEMINJAMAN } from "@/lib/labels";
import { getPeminjaman } from "@/lib/peminjaman";
import { PemasanganForm } from "../kejadian-forms";

export const metadata: Metadata = { title: "Pemasangan" };

export default async function PemasanganPage({ params }: PageProps<"/peminjaman/[id]/pemasangan">) {
  await requirePermission("pemasangan.create");
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) notFound();
  const p = await getPeminjaman(pid);
  if (!p) notFound();

  return (
    <>
      <Link href={`/peminjaman/${p.id}`} className="mb-2 inline-block text-sm text-cyan-700 hover:underline">
        ← Kembali ke {p.kode}
      </Link>
      <PageHeader
        title={`Pemasangan ${p.kode}`}
        description={`${p.namaPeminjam} · ${p.divisi} · ${p.ruangan} · keluar ${formatWita(p.tglPeminjaman)}`}
      />
      {!((p.status === "diajukan" || p.status === "terlambat") && !p.terpasang) ? (
        <Alert color="warning">
          Pemasangan hanya untuk peminjaman yang unitnya belum dipasang. Status sekarang: {STATUS_PEMINJAMAN[p.status].label}.
        </Alert>
      ) : (
        <PemasanganForm peminjamanId={p.id} units={p.units} />
      )}
    </>
  );
}
