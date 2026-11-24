import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "flowbite-react";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth";
import { formatWita } from "@/lib/datetime";
import { STATUS_PEMINJAMAN } from "@/lib/labels";
import { getPeminjaman } from "@/lib/peminjaman";
import { PengembalianForm } from "../kejadian-forms";

export const metadata: Metadata = { title: "Pengembalian" };

export default async function PengembalianPage({ params }: PageProps<"/peminjaman/[id]/pengembalian">) {
  await requirePermission("pengembalian.create");
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) notFound();
  const p = await getPeminjaman(pid);
  if (!p) notFound();

  const bisa = p.status === "dipinjam" || p.status === "terlambat";

  return (
    <>
      <Link href={`/peminjaman/${p.id}`} className="mb-2 inline-block text-sm text-cyan-700 hover:underline">
        ← Kembali ke {p.kode}
      </Link>
      <PageHeader
        title={`Pengembalian ${p.kode}`}
        description={`${p.namaPeminjam} · ${p.divisi} · ${p.ruangan} · rencana kembali ${formatWita(p.tglRencanaKembali)}`}
      />
      {!bisa ? (
        <Alert color="warning">
          Pengembalian hanya untuk peminjaman berstatus Dipinjam atau Terlambat. Status sekarang:{" "}
          {STATUS_PEMINJAMAN[p.status].label}.
        </Alert>
      ) : (
        <>
          {p.status === "terlambat" && (
            <Alert color="failure" className="mb-4">Peminjaman ini terlambat dikembalikan.</Alert>
          )}
          <PengembalianForm peminjamanId={p.id} units={p.units} />
        </>
      )}
    </>
  );
}
