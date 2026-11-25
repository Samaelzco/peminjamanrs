import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusPill } from "@/components/peminjaman-table";
import { Card, CardTitle, EmptyState, InfoGrid, InfoItem, PageHeader, Pill } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { formatTanggal, formatWaktu } from "@/lib/datetime";
import { KONDISI, STATUS_ASET } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Detail Barang" };

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
      <PageHeader
        back={{ href: "/aset", label: "Kembali ke Data Barang" }}
        title={aset.kode_aset}
        description={aset.nama_aset}
      />

      <div className="grid gap-3 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start lg:gap-4">
        <Card>
          <div className="mb-3.5 flex flex-wrap items-center gap-2">
            <CardTitle className="me-auto">Informasi Barang</CardTitle>
            <Pill tone={STATUS_ASET[aset.status].tone}>{STATUS_ASET[aset.status].label}</Pill>
            <Pill tone={KONDISI[aset.kondisi].tone}>Kondisi {KONDISI[aset.kondisi].label}</Pill>
          </div>
          <InfoGrid className="md:grid-cols-2 lg:grid-cols-1">
            <InfoItem label="Nama Barang">{aset.nama_aset}</InfoItem>
            <InfoItem label="Kategori">{aset.kategori?.nama ?? "-"}</InfoItem>
            <InfoItem label="Deskripsi" className="col-span-2 md:col-span-1">
              {aset.deskripsi ?? "-"}
            </InfoItem>
            <InfoItem label="Terdaftar">{formatTanggal(aset.created_at)}</InfoItem>
          </InfoGrid>
        </Card>

        <section aria-labelledby="riwayat-aset">
          <h2 id="riwayat-aset" className="mb-3 text-base font-semibold text-gray-900">
            Riwayat Peminjaman
          </h2>
          {!bisaLihatPeminjaman ? (
            <EmptyState>Anda tidak punya izin melihat peminjaman.</EmptyState>
          ) : (riwayat ?? []).length === 0 ? (
            <EmptyState>Belum pernah dipinjam.</EmptyState>
          ) : (
            <ul className="grid gap-3 xl:grid-cols-2">
              {(riwayat ?? []).map((r) => (
                <li key={r.id} className="relative rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/peminjaman/${r.peminjaman.id}`}
                      className="font-bold text-gray-900 after:absolute after:inset-0 after:rounded-xl hover:text-brand-700"
                    >
                      {r.peminjaman.kode_peminjaman}
                    </Link>
                    <StatusPill status={r.peminjaman.status} />
                  </div>
                  <p className="mt-1 text-[15px] break-words text-gray-900">
                    {r.peminjaman.nama_peminjam} · {r.peminjaman.divisi_peminjam}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {formatWaktu(r.peminjaman.tgl_peminjaman)} → {formatWaktu(r.peminjaman.tgl_rencana_kembali)}
                  </p>
                  {(r.kondisi_keluar || r.kondisi_masuk) && (
                    <p className="mt-1 text-sm text-gray-600">
                      {r.kondisi_keluar ? `Keluar: ${KONDISI[r.kondisi_keluar].label}` : ""}
                      {r.kondisi_masuk ? ` · Masuk: ${KONDISI[r.kondisi_masuk].label}` : ""}
                    </p>
                  )}
                  {r.catatan && <p className="mt-1 text-sm break-words text-gray-500">Catatan: {r.catatan}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
