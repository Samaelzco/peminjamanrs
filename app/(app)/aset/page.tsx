import type { Metadata } from "next";
import { PageHeader, StatCard, StatGrid } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { KONDISI_ASET_LIST, STATUS_ASET_LIST, type KondisiAset, type StatusAset } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { AsetView } from "./aset-view";

export const metadata: Metadata = { title: "Data Barang" };

function one(v: string | string[] | undefined) {
  return typeof v === "string" ? v : undefined;
}

export default async function AsetPage({ searchParams }: PageProps<"/aset">) {
  const user = await requirePermission("aset.view");
  const sp = await searchParams;

  const kategoriId = Number(one(sp.kategori)) || undefined;
  const status = STATUS_ASET_LIST.find((s) => s === one(sp.status)) as StatusAset | undefined;
  const kondisi = KONDISI_ASET_LIST.find((k) => k === one(sp.kondisi)) as KondisiAset | undefined;
  const q = one(sp.q)?.trim().slice(0, 60);

  const supabase = await createClient();
  let query = supabase
    .from("aset")
    .select("id, kode_aset, nama_aset, deskripsi, kondisi, status, kategori_id, kategori(nama)")
    .order("kode_aset");
  if (kategoriId) query = query.eq("kategori_id", kategoriId);
  if (status) query = query.eq("status", status);
  if (kondisi) query = query.eq("kondisi", kondisi);
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(`kode_aset.ilike.%${safe}%,nama_aset.ilike.%${safe}%`);
  }

  const [{ data: aset, error }, { data: kategori }, { data: semua }] = await Promise.all([
    query,
    supabase.from("kategori").select("id, nama, kode_prefix").order("nama"),
    supabase.from("aset").select("status, kondisi"),
  ]);
  if (error) throw new Error(error.message);

  const statistik = (semua ?? []).reduce(
    (acc, a) => {
      acc.total++;
      if (a.status === "tersedia") acc.tersedia++;
      if (a.status === "dipinjam") acc.dipinjam++;
      if (a.status === "hilang" || a.kondisi === "rusak") acc.rusakHilang++;
      return acc;
    },
    { total: 0, tersedia: 0, dipinjam: 0, rusakHilang: 0 },
  );

  return (
    <>
      <PageHeader title="Data Barang" description="Setiap unit fisik punya kode sendiri" />
      <StatGrid>
        <StatCard label="Total Unit" value={statistik.total} />
        <StatCard label="Tersedia" value={statistik.tersedia} tone="green" />
        <StatCard label="Dipinjam" value={statistik.dipinjam} tone="blue" />
        <StatCard label="Rusak / Hilang" value={statistik.rusakHilang} tone="red" />
      </StatGrid>
      <AsetView
        aset={(aset ?? []).map((a) => ({
          id: a.id,
          kodeAset: a.kode_aset,
          namaAset: a.nama_aset,
          deskripsi: a.deskripsi,
          kondisi: a.kondisi,
          status: a.status,
          kategoriId: a.kategori_id,
          kategoriNama: a.kategori?.nama ?? "-",
        }))}
        kategori={kategori ?? []}
        filter={{ kategori: kategoriId ? String(kategoriId) : "", status: status ?? "", kondisi: kondisi ?? "", q: q ?? "" }}
        canCreate={user.permissions.includes("aset.create")}
        canUpdate={user.permissions.includes("aset.update")}
        canDelete={user.permissions.includes("aset.delete")}
      />
    </>
  );
}
