import type { Metadata } from "next";
import { LuDownload } from "react-icons/lu";
import { PEMINJAMAN_ROW_SELECT, PeminjamanList, toPeminjamanRow } from "@/components/peminjaman-table";
import { PageHeader, buttonClass } from "@/components/ui";
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

  // Filter aktif (tanpa halaman) dipakai untuk ekspor dan pagination.
  const filter = Object.fromEntries(
    Object.entries({ q, status: status ?? "", dari: dari ?? "", sampai: sampai ?? "" }).filter(([, v]) => v),
  );
  const ekspor = new URLSearchParams(filter).toString();

  const total = count ?? 0;
  const totalHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN));

  return (
    <>
      <PageHeader
        title="Riwayat Peminjaman"
        description="Semua peminjaman yang pernah dicatat, termasuk yang dibatalkan dan selesai."
        actions={
          user.permissions.includes("laporan.export") && (
            // Tautan biasa (bukan <Link>) karena tujuannya file unduhan dari route handler.
            <a
              href={`/riwayat/ekspor${ekspor ? `?${ekspor}` : ""}`}
              className={buttonClass({ variant: "secondary", className: "w-full bg-white sm:w-auto" })}
            >
              <LuDownload className="h-4 w-4" aria-hidden />
              Unduh Rekap (Excel)
            </a>
          )
        }
      />
      <RiwayatFilters value={{ q, status: status ?? "", dari: dari ?? "", sampai: sampai ?? "" }} />
      <p className="mb-3 text-sm text-gray-500" aria-live="polite">
        {total === 0
          ? "Tidak ada peminjaman yang cocok."
          : `Menampilkan ${from + 1}–${Math.min(from + PER_HALAMAN, total)} dari ${total} peminjaman`}
      </p>
      <PeminjamanList
        rows={(data ?? []).map(toPeminjamanRow)}
        varian="riwayat"
        empty="Tidak ada peminjaman yang cocok."
        bisaUbah={user.permissions.includes("peminjaman.update")}
      />
      {totalHalaman > 1 && (
        <RiwayatPagination halaman={Math.min(halaman, totalHalaman)} totalHalaman={totalHalaman} params={filter} />
      )}
    </>
  );
}
