import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth";
import { toWitaInput } from "@/lib/datetime";
import type { StatusPeminjaman } from "@/lib/labels";
import { getPeminjaman } from "@/lib/peminjaman";
import { UbahForm } from "./ubah-form";

export const metadata: Metadata = { title: "Ubah Peminjaman" };

export default async function UbahPeminjamanPage({ params }: PageProps<"/peminjaman/[id]/ubah">) {
  await requirePermission("peminjaman.update");
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) notFound();
  const p = await getPeminjaman(pid);
  if (!p) notFound();

  // Status yang boleh dipilih (aturan sama dengan RPC ubah_peminjaman).
  let statusDikunci: string | null = null;
  let opsiStatus: StatusPeminjaman[];
  if (p.pengembalian) {
    statusDikunci = "Status dikunci karena pengembalian sudah dicatat.";
    opsiStatus = [p.status];
  } else if (p.sesudahnya) {
    statusDikunci = `Status dikunci karena sudah diperpanjang menjadi ${p.sesudahnya.kode_peminjaman}.`;
    opsiStatus = [p.status];
  } else if (p.terpasang) {
    opsiStatus = ["dipinjam", "terlambat", "selesai"];
  } else {
    opsiStatus = ["diajukan", "terlambat", "dibatalkan"];
  }

  return (
    <>
      <Link href={`/peminjaman/${p.id}`} className="mb-2 inline-block text-sm text-cyan-700 hover:underline">
        ← Kembali ke {p.kode}
      </Link>
      <PageHeader
        title={`Ubah ${p.kode}`}
        description="Perbaiki data peminjaman atau ubah status secara manual. Setiap perubahan tercatat di timeline."
      />
      <UbahForm
        peminjamanId={p.id}
        awal={{
          nama_peminjam: p.namaPeminjam,
          kontak_peminjam: p.kontak,
          divisi_peminjam: p.divisi,
          ruangan: p.ruangan,
          keperluan: p.keperluan,
          tgl_peminjaman: toWitaInput(p.tglPeminjaman),
          tgl_rencana_kembali: toWitaInput(p.tglRencanaKembali),
          status: p.status,
        }}
        opsiStatus={opsiStatus}
        statusDikunci={statusDikunci}
        terpasang={p.terpasang}
      />
    </>
  );
}
