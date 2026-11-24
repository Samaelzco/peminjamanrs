import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth";
import { toWitaInput } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import { PeminjamanForm } from "./peminjaman-form";

export const metadata: Metadata = { title: "Peminjaman Baru" };

export default async function PeminjamanBaruPage() {
  await requirePermission("peminjaman.create");
  const supabase = await createClient();
  const { data: kategori } = await supabase.from("kategori").select("id, nama").order("nama");

  // Default: keluar sekarang (dibulatkan ke 15 menit), kembali +8 jam.
  await connection(); // waktu "sekarang" dihitung saat request
  const now = new Date();
  now.setSeconds(0, 0);
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);
  const kembali = new Date(now.getTime() + 8 * 3600_000);

  return (
    <>
      <PageHeader
        title="Peminjaman Baru"
        description="Pilih kategori dan jumlah. Sistem otomatis mengambil unit tersedia dengan kode terkecil."
      />
      <PeminjamanForm
        kategori={kategori ?? []}
        defaultKeluar={toWitaInput(now)}
        defaultKembali={toWitaInput(kembali)}
      />
    </>
  );
}
