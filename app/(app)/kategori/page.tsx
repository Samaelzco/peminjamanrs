import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KategoriTable } from "./kategori-table";

export const metadata: Metadata = { title: "Kategori" };

export default async function KategoriPage() {
  const user = await requirePermission("kategori.view");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kategori")
    .select("id, nama, kode_prefix, aset(count)")
    .order("nama");
  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader title="Kategori" description="Kategori menentukan prefix kode aset, contoh LPT-001." />
      <KategoriTable
        kategori={(data ?? []).map((k) => ({
          id: k.id,
          nama: k.nama,
          kodePrefix: k.kode_prefix,
          jumlahAset: k.aset[0]?.count ?? 0,
        }))}
        canCreate={user.permissions.includes("kategori.create")}
        canUpdate={user.permissions.includes("kategori.update")}
        canDelete={user.permissions.includes("kategori.delete")}
      />
    </>
  );
}
