import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth";
import { KONDISI_ASET_LIST, STATUS_ASET_LIST, type KondisiAset, type StatusAset } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { AsetFilters } from "./aset-filters";
import { AsetTable } from "./aset-table";

export const metadata: Metadata = { title: "Data Aset" };

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

  const [{ data: aset, error }, { data: kategori }] = await Promise.all([
    query,
    supabase.from("kategori").select("id, nama, kode_prefix").order("nama"),
  ]);
  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader title="Data Aset" description="Kode aset dibuat otomatis dari prefix kategori." />
      <AsetFilters
        kategori={kategori ?? []}
        value={{ kategori: kategoriId ? String(kategoriId) : "", status: status ?? "", kondisi: kondisi ?? "", q: q ?? "" }}
      />
      <AsetTable
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
        canCreate={user.permissions.includes("aset.create")}
        canUpdate={user.permissions.includes("aset.update")}
        canDelete={user.permissions.includes("aset.delete")}
      />
    </>
  );
}
