import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PEMINJAMAN_ROW_SELECT, PeminjamanCard, toPeminjamanRow, type PeminjamanRow } from "@/components/peminjaman-table";
import { ButtonLink, EmptyState, PageHeader, SectionTitle, StatCard, StatGrid } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatTanggal } from "@/lib/datetime";
import { menuFor } from "@/lib/menu";
import { createClient } from "@/lib/supabase/server";
import { PeminjamanBerjalan } from "./dashboard-berjalan";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const perms = user.permissions;
  if (!perms.includes("dashboard.view")) {
    const first = menuFor(perms)[0];
    if (first && first.href !== "/") redirect(first.href);
  }

  const supabase = await createClient();
  const sarpras = perms.includes("pemasangan.create");
  const bisaLihat = perms.includes("peminjaman.view");

  const hitung = (status: "dibatalkan" | "selesai") =>
    bisaLihat
      ? supabase.from("peminjaman").select("id", { count: "exact", head: true }).eq("status", status)
      : Promise.resolve({ count: null });

  const [{ data: ringkasan }, { count: dibatalkan }, { count: selesai }, { data: berjalan }] = await Promise.all([
    supabase.rpc("ringkasan_dashboard").single(),
    hitung("dibatalkan"),
    hitung("selesai"),
    bisaLihat
      ? supabase
          .from("peminjaman")
          .select(PEMINJAMAN_ROW_SELECT)
          .in("status", ["diajukan", "dipinjam", "terlambat"])
          .order("tgl_rencana_kembali")
          .limit(200)
      : Promise.resolve({ data: [] }),
  ]);

  const rows = (berjalan ?? []).map(toPeminjamanRow);

  return (
    <>
      <PageHeader
        title={sarpras ? "Dashboard Sarpras" : "Dashboard"}
        description={
          sarpras ? "Tugas pemasangan, pengecekan, dan pengembalian barang" : "Ringkasan peminjaman yang sedang berjalan"
        }
      />

      <StatGrid>
        <StatCard label="Dibatalkan" value={dibatalkan ?? 0} />
        <StatCard label="Menunggu Pemasangan" value={ringkasan?.diajukan ?? 0} tone="amber" />
        <StatCard label="Terlambat" value={ringkasan?.terlambat ?? 0} tone="red" />
        <StatCard label="Selesai" value={selesai ?? 0} tone="green" />
      </StatGrid>

      {!bisaLihat ? null : sarpras ? (
        <TugasSarpras rows={rows} bisaKembali={perms.includes("pengembalian.create")} />
      ) : (
        <PeminjamanBerjalan rows={rows} bisaBuat={perms.includes("peminjaman.create")} />
      )}
    </>
  );
}

function TugasSarpras({ rows, bisaKembali }: { rows: PeminjamanRow[]; bisaKembali: boolean }) {
  const menunggu = rows
    .filter((r) => !r.terpasang && r.status !== "dipinjam")
    .sort((a, b) => a.tglPeminjaman.localeCompare(b.tglPeminjaman));
  const terlambat = rows.filter((r) => r.terpasang && r.status === "terlambat");
  const dipinjam = rows.filter((r) => r.terpasang && r.status === "dipinjam");

  const sections = [
    {
      judul: "Menunggu Pemasangan",
      kosong: "Tidak ada peminjaman yang menunggu pemasangan.",
      rows: menunggu,
      aksi: (r: PeminjamanRow) => ({ href: `/peminjaman/${r.id}/pemasangan`, label: "Pemasangan" }),
      meta: (r: PeminjamanRow) => (
        <div className="mt-1 space-y-1 text-sm text-gray-500">
          <p className="break-words">{r.ruangan} · Keluar {formatTanggal(r.tglPeminjaman)}</p>
          <p className="break-words text-gray-700">{r.barang}</p>
        </div>
      ),
    },
    {
      judul: "Terlambat — Perlu Dicek ke Lokasi",
      kosong: "Tidak ada peminjaman terlambat.",
      rows: terlambat,
      aksi: (r: PeminjamanRow) =>
        bisaKembali ? { href: `/peminjaman/${r.id}/pengembalian`, label: "Pengembalian" } : null,
      meta: (r: PeminjamanRow) => (
        <div className="mt-1 space-y-1 text-sm text-gray-500">
          <p className="break-words">
            {r.ruangan} · <span className="font-semibold text-red-800">Tgl kembali {formatTanggal(r.tglRencanaKembali)}</span>
          </p>
          <p>
            Kontak{" "}
            <a href={`tel:${r.kontak}`} className="relative z-10 font-medium text-brand-700 hover:underline">
              {r.kontak}
            </a>
          </p>
        </div>
      ),
    },
    {
      judul: "Sedang Dipinjam",
      kosong: "Tidak ada peminjaman berjalan.",
      rows: dipinjam,
      aksi: (r: PeminjamanRow) =>
        bisaKembali ? { href: `/peminjaman/${r.id}/pengembalian`, label: "Pengembalian" } : null,
      meta: (r: PeminjamanRow) => (
        <p className="mt-1 text-sm break-words text-gray-500">
          {r.ruangan} · Tgl kembali {formatTanggal(r.tglRencanaKembali)}
        </p>
      ),
    },
  ];

  return (
    <div className="mt-6 space-y-8">
      {sections.map((s) => (
        <section key={s.judul} aria-label={s.judul}>
          <SectionTitle count={s.rows.length}>{s.judul}</SectionTitle>
          {s.rows.length === 0 ? (
            <EmptyState>{s.kosong}</EmptyState>
          ) : (
            <ul className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
              {s.rows.map((r) => {
                const a = s.aksi(r);
                return (
                  <PeminjamanCard
                    key={r.id}
                    row={r}
                    meta={s.meta(r)}
                    aksi={
                      <div className="grid grid-cols-2 gap-2">
                        <ButtonLink href={`/peminjaman/${r.id}`} variant="secondary" className={a ? "" : "col-span-2"}>
                          Detail
                        </ButtonLink>
                        {a && <ButtonLink href={a.href}>{a.label}</ButtonLink>}
                      </div>
                    }
                  />
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
