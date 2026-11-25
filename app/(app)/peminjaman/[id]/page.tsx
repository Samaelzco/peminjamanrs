import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LuCamera } from "react-icons/lu";
import { StatusPill } from "@/components/peminjaman-table";
import { PhotoGallery } from "@/components/photo-gallery";
import { Alert, Card, CardTitle, InfoGrid, InfoItem, PageHeader, Pill } from "@/components/ui";
import { requireAnyPermission } from "@/lib/auth";
import { formatWaktu, menitSejak } from "@/lib/datetime";
import { KONDISI } from "@/lib/labels";
import { getPeminjaman } from "@/lib/peminjaman";
import type { Permission } from "@/lib/permissions";
import { AksiPeminjaman } from "./aksi-peminjaman";
import { Timeline } from "./timeline";

export const metadata: Metadata = { title: "Detail Peminjaman" };

export default async function DetailPeminjamanPage({ params, searchParams }: PageProps<"/peminjaman/[id]">) {
  const user = await requireAnyPermission("peminjaman.view", "riwayat.view");
  const { id } = await params;
  const { baru, perpanjangan, diubah } = await searchParams;
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) notFound();

  await connection(); // waktu "sekarang" dihitung saat request
  const p = await getPeminjaman(pid);
  if (!p) notFound();

  const terlambatMenit = p.status === "terlambat" ? menitSejak(p.tglRencanaKembali) : 0;
  const can = (perm: Permission) => user.permissions.includes(perm);

  const aksi = (
    <AksiPeminjaman
      id={p.id}
      kode={p.kode}
      status={p.status}
      terpasang={p.terpasang}
      can={{
        update: can("peminjaman.update"),
        pemasangan: can("pemasangan.create"),
        pengembalian: can("pengembalian.create"),
        extend: can("peminjaman.extend"),
        cancel: can("peminjaman.cancel"),
      }}
    />
  );

  return (
    <>
      <PageHeader
        back={{ href: "/", label: "Kembali ke Dashboard" }}
        title={
          <>
            <span className="font-bold">Detail Peminjaman · </span>
            <span data-kode>{p.kode}</span>
          </>
        }
        description={`Dicatat oleh ${p.dicatatOleh} · ${formatWaktu(p.createdAt)}`}
      />

      <div className="space-y-3">
        {baru === "1" && (
          <Alert tone={p.status === "terlambat" ? "warning" : "success"}>
            Peminjaman {p.kode} tersimpan dengan status {p.status === "terlambat" ? "Terlambat" : "Menunggu Pemasangan"}
            {p.status === "terlambat" && " karena rencana kembali sudah lewat"}. Petugas Sarpras sudah diberi notifikasi.
          </Alert>
        )}
        {diubah === "1" && <Alert tone="success">Perubahan {p.kode} tersimpan.</Alert>}
        {perpanjangan === "1" && p.sebelumnya && (
          <Alert tone="success">
            Perpanjangan berhasil. {p.kode} langsung berstatus Dipinjam; {p.sebelumnya.kode_peminjaman} ditutup menjadi
            Selesai.
          </Alert>
        )}
        {p.status === "terlambat" && (
          <Alert tone="danger">
            Terlambat {formatDurasi(terlambatMenit)} dari tanggal kembali ({formatWaktu(p.tglRencanaKembali)}).
            {!p.terpasang && " Unit belum dipasang."}
          </Alert>
        )}
      </div>

      <div className="mt-3 grid gap-3 lg:mt-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-4">
        <div className="space-y-3 lg:space-y-4">
          <Card>
            <CardTitle className="mb-3.5">Informasi Peminjaman</CardTitle>
            <InfoGrid>
              <InfoItem label="Nama Peminjam">{p.namaPeminjam}</InfoItem>
              <InfoItem label="Nomor Kontak">
                <a href={`tel:${p.kontak}`} className="hover:text-brand-700 hover:underline">
                  {p.kontak}
                </a>
              </InfoItem>
              <InfoItem label="Unit Peminjam">{p.divisi}</InfoItem>
              <InfoItem label="Ruangan">{p.ruangan}</InfoItem>
              <InfoItem label="Tanggal Keluar">{formatWaktu(p.tglPeminjaman)}</InfoItem>
              <InfoItem label="Tanggal Kembali">{formatWaktu(p.tglRencanaKembali)}</InfoItem>
              <InfoItem label="Status">
                <StatusPill status={p.status} />
              </InfoItem>
              <InfoItem label="Validasi Pemasangan">
                {p.pemasangan ? (
                  <Pill tone="green" wrap>
                    {p.pemasangan.staffNama ?? "Sarpras"} · {formatWaktu(p.pemasangan.tgl)}
                  </Pill>
                ) : p.terpasang ? (
                  <Pill tone="teal">Lanjutan perpanjangan</Pill>
                ) : (
                  <Pill tone="gray">Belum divalidasi</Pill>
                )}
              </InfoItem>
              {p.pengembalian && (
                <InfoItem label="Validasi Pengembalian">
                  <Pill tone="green" wrap>
                    {p.pengembalian.staffNama ?? "Sarpras"} · {formatWaktu(p.pengembalian.tgl)}
                  </Pill>
                </InfoItem>
              )}
              <InfoItem label="Alasan Peminjaman" className="col-span-2 md:col-span-3">
                {p.keperluan}
              </InfoItem>
            </InfoGrid>
          </Card>

          <Card>
            <CardTitle className="mb-3">Unit Dipinjam ({p.units.length})</CardTitle>
            <ul className="grid gap-3 md:grid-cols-2">
              {p.units.map((u) => {
                const kondisi = u.kondisiMasuk ? KONDISI[u.kondisiMasuk] : null;
                return (
                  <li key={u.detailId} className="rounded-lg border border-gray-200 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/aset/${u.asetId}`}
                        className="font-bold text-gray-900 hover:text-brand-700 hover:underline"
                      >
                        {u.kodeAset}
                      </Link>
                      {kondisi ? (
                        <Pill tone={kondisi.tone}>Kembali: {kondisi.label}</Pill>
                      ) : p.terpasang && (p.status === "dipinjam" || p.status === "terlambat") ? (
                        <Pill tone="blue">Dipinjam</Pill>
                      ) : p.status === "dibatalkan" ? (
                        <Pill tone="gray">Dibatalkan</Pill>
                      ) : (
                        <Pill tone="gray">Belum dipasang</Pill>
                      )}
                    </div>
                    <p className="mt-0.5 text-[15px] break-words text-gray-900">{u.namaAset}</p>
                    <p className="text-sm text-gray-500">{u.kategoriNama}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                      <span className="text-gray-600">
                        Kondisi keluar: {u.kondisiKeluar ? KONDISI[u.kondisiKeluar].label : "—"}
                      </span>
                      <span className="min-w-0 break-words text-gray-600">Keterangan: {u.catatan || "—"}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {(p.pemasangan || p.pengembalian) && (
            <div className="grid gap-3 md:grid-cols-2 lg:gap-4">
              {p.pemasangan && (
                <Card>
                  <FotoTitle judul="Foto Pemasangan" jumlah={p.pemasangan.foto.length} />
                  <PhotoGallery title={`Foto pemasangan ${p.kode}`} photos={p.pemasangan.foto} />
                </Card>
              )}
              {p.pengembalian && (
                <Card>
                  <FotoTitle judul="Foto Pengembalian" jumlah={p.pengembalian.foto.length} />
                  <PhotoGallery title={`Foto pengembalian ${p.kode}`} photos={p.pengembalian.foto} />
                </Card>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3 lg:sticky lg:top-20 lg:space-y-4">
          {(p.sebelumnya || p.sesudahnya) && (
            <Card>
              <CardTitle className="mb-2">Rantai Perpanjangan</CardTitle>
              <ol className="space-y-2 text-sm">
                {p.sebelumnya && (
                  <li>
                    <span className="text-gray-500">Perpanjangan dari </span>
                    <Link
                      href={`/peminjaman/${p.sebelumnya.id}`}
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      {p.sebelumnya.kode_peminjaman}
                    </Link>
                  </li>
                )}
                {p.sesudahnya && (
                  <li className="flex flex-wrap items-center gap-2">
                    <span className="text-gray-500">Diperpanjang menjadi </span>
                    <Link
                      href={`/peminjaman/${p.sesudahnya.id}`}
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      {p.sesudahnya.kode_peminjaman}
                    </Link>
                    <StatusPill status={p.sesudahnya.status} />
                  </li>
                )}
              </ol>
            </Card>
          )}

          <Card>
            <CardTitle className="mb-3">Timeline</CardTitle>
            <Timeline events={p.timeline} />
          </Card>

          {aksi}
        </div>
      </div>
    </>
  );
}

function FotoTitle({ judul, jumlah }: { judul: string; jumlah: number }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <CardTitle>{judul}</CardTitle>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
        <LuCamera className="h-4 w-4" aria-hidden />
        {jumlah} foto
      </span>
    </div>
  );
}

function formatDurasi(menit: number) {
  const hari = Math.floor(menit / 1440);
  const jam = Math.floor((menit % 1440) / 60);
  const m = menit % 60;
  return [hari && `${hari} hari`, jam && `${jam} jam`, `${m} menit`].filter(Boolean).join(" ");
}
