import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Alert, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { formatTanggal, menitSejak } from "@/lib/datetime";
import { STATUS_PEMINJAMAN } from "@/lib/labels";
import { getPeminjaman } from "@/lib/peminjaman";
import { PengembalianForm } from "../kejadian-forms";
import { RingkasanPeminjaman } from "../ringkasan-peminjaman";

export const metadata: Metadata = { title: "Validasi Pengembalian" };

export default async function PengembalianPage({ params }: PageProps<"/peminjaman/[id]/pengembalian">) {
  await requirePermission("pengembalian.create");
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) notFound();
  await connection();
  const p = await getPeminjaman(pid);
  if (!p) notFound();

  const bisa = (p.status === "dipinjam" || p.status === "terlambat") && p.terpasang;
  const hariTerlambat = Math.max(1, Math.ceil(menitSejak(p.tglRencanaKembali) / 1440));

  return (
    <>
      <PageHeader
        back={{ href: "/", label: "Kembali ke Dashboard" }}
        title={`Validasi Pengembalian · ${p.kode}`}
        description="Cek kondisi barang di lokasi peminjam"
      />
      {!bisa ? (
        <Alert tone="warning">
          Pengembalian hanya untuk peminjaman yang sudah dipasang dan berstatus Dipinjam atau Terlambat. Status sekarang:{" "}
          {STATUS_PEMINJAMAN[p.status].label}.
        </Alert>
      ) : (
        <div className="space-y-3 lg:space-y-4">
          {p.status === "terlambat" ? (
            <Alert tone="danger">
              Terlambat {hariTerlambat} hari · Tgl kembali {formatTanggal(p.tglRencanaKembali)} · {p.namaPeminjam} (
              {p.divisi}) · {p.kontak} · {p.ruangan}
            </Alert>
          ) : (
            <RingkasanPeminjaman p={p} />
          )}
          <PengembalianForm peminjamanId={p.id} units={p.units} />
        </div>
      )}
    </>
  );
}
