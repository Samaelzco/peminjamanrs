import type { Metadata } from "next";
import { HiOutlineArrowDownTray } from "react-icons/hi2";
import { Button } from "flowbite-react";
import { PageHeader } from "@/components/page-header";
import { PEMINJAMAN_ROW_SELECT, PeminjamanTable, toPeminjamanRow } from "@/components/peminjaman-table";
import { requirePermission } from "@/lib/auth";
import { awalHariWita, kondisiCari, parseFilterRiwayat } from "@/lib/riwayat-filter";
import { createClient } from "@/lib/supabase/server";
import { RiwayatFilters } from "./riwayat-filters";
import { RiwayatPagination } from "./riwayat-pagination";

export const metadata: Metadata = { title: "Riwayat Peminjaman" };

const PER_HALAMAN = 20;

export default async function RiwayatPage({ searchParams }: PageProps<"/riwayat">) {
  const user = await requirePermission("riwayat.view");
  const sp = await searchParams;

  const { q, status, dari, sampai } = parseFilterRiwayat(sp);
  const halaman = Math.max(1, Number(typeof sp.halaman === "string" ? sp.halaman : 1) || 1);

  const supabase = await createClient();
  const cari = await kondisiCari(q);

  let query = supabase
    .from("peminjaman")
    .select(PEMINJAMAN_ROW_SELECT, { count: "exact" })
    .order("tgl_peminjaman", { ascending: false })
    .order("id", { ascending: false });

  if (cari) query = query.or(cari);
  if (status) query = query.eq("status", status);
  if (dari) query = query.gte("tgl_peminjaman", awalHariWita(dari));
  if (sampai) query = query.lt("tgl_peminjaman", awalHariWita(sampai, 1));

  const from = (halaman - 1) * PER_HALAMAN;
  const { data, count, error } = await query.range(from, from + PER_HALAMAN - 1);
  if (error && error.code !== "PGRST103") throw new Error(error.message); // PGRST103: halaman di luar jangkauan

  // Ekspor memakai filter yang sedang aktif (tanpa halaman).
  const ekspor = new URLSearchParams(
    Object.entries({ q, status: status ?? "", dari: dari ?? "", sampai: sampai ?? "" }).filter(([, v]) => v),
  ).toString();

  const total = count ?? 0;
  const totalHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN));

  return (
    <>
      <PageHeader
        title="Riwayat Peminjaman"
        description="Semua peminjaman, termasuk yang dibatalkan dan selesai."
        actions={
          // Tautan biasa (bukan <Link>) karena tujuannya file unduhan dari route handler.
          <Button as="a" href={`/riwayat/ekspor${ekspor ? `?${ekspor}` : ""}`} color="light">
            <HiOutlineArrowDownTray className="me-1.5 h-4 w-4" />
            Unduh Rekap (Excel)
          </Button>
        }
      />
      <RiwayatFilters value={{ q, status: status ?? "", dari: dari ?? "", sampai: sampai ?? "" }} />
      <p className="mb-3 text-sm text-gray-500">
        {total === 0
          ? "Tidak ada peminjaman yang cocok."
          : `Menampilkan ${from + 1}–${Math.min(from + PER_HALAMAN, total)} dari ${total} peminjaman`}
      </p>
      <PeminjamanTable rows={(data ?? []).map(toPeminjamanRow)} empty="Tidak ada peminjaman yang cocok."
        bisaUbah={user.permissions.includes("peminjaman.update")}
      />
      {totalHalaman > 1 && <RiwayatPagination halaman={Math.min(halaman, totalHalaman)} totalHalaman={totalHalaman} />}
    </>
  );
}
