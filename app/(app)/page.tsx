import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PEMINJAMAN_ROW_SELECT, PeminjamanCard, toPeminjamanRow, type PeminjamanRow } from "@/components/peminjaman-table";
import { ButtonLink, EmptyState, PageHeader, Pill, SectionTitle, StatCard, StatGrid } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatTanggal, menitSejak } from "@/lib/datetime";
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

  await connection(); // "Telat N hari" dihitung saat request
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
        <StatCard label="Menunggu Pemasangan" value={ringkasan?.diajukan ?? 0} tone="amber" />
        <StatCard label="Terlambat" value={ringkasan?.terlambat ?? 0} tone="red" />
        <StatCard label="Selesai" value={selesai ?? 0} tone="green" />
        <StatCard label="Dibatalkan" value={dibatalkan ?? 0} />
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
  const hariTelat = (r: PeminjamanRow) => Math.max(1, Math.ceil(menitSejak(r.tglRencanaKembali) / 1440));

  const sections: {
    judul: string;
    kosong: string;
    rows: PeminjamanRow[];
    kanan?: (r: PeminjamanRow) => React.ReactNode;
    meta: (r: PeminjamanRow) => React.ReactNode;
    aksi: (r: PeminjamanRow) => React.ReactNode;
  }[] = [
    {
      judul: "Menunggu Pemasangan",
      kosong: "Tidak ada peminjaman yang menunggu pemasangan.",
      rows: menunggu,
      kanan: (r) => (
        <span className="shrink-0 text-sm text-gray-500">
          {r.status === "terlambat" ? <Pill tone="red">Terlambat</Pill> : formatTanggal(r.tglPeminjaman)}
        </span>
      ),
      meta: (r) => (
        <div className="mt-1 space-y-1 text-sm text-gray-500">
          <p className="break-words">{r.ruangan}</p>
          <p className="break-words">{r.barang}</p>
        </div>
      ),
      aksi: (r) => (
        <ButtonLink href={`/peminjaman/${r.id}/pemasangan`} block>
          Validasi
        </ButtonLink>
      ),
    },
    {
      judul: "Terlambat — Perlu Dicek ke Lokasi",
      kosong: "Tidak ada peminjaman terlambat.",
      rows: terlambat,
      kanan: (r) => <Pill tone="red">Telat {hariTelat(r)} hari</Pill>,
      meta: (r) => (
        <div className="mt-1 space-y-1 text-sm text-gray-500">
          <p className="break-words">
            {r.ruangan} · Tgl kembali {formatTanggal(r.tglRencanaKembali)}
          </p>
          <p>
            Kontak{" "}
            <a href={`tel:${r.kontak}`} className="relative z-10 hover:text-brand-700 hover:underline">
              {r.kontak}
            </a>
          </p>
        </div>
      ),
      aksi: (r) =>
        bisaKembali ? (
          <ButtonLink href={`/peminjaman/${r.id}/pengembalian`} block>
            Cek Barang
          </ButtonLink>
        ) : null,
    },
    {
      judul: "Sedang Dipinjam",
      kosong: "Tidak ada peminjaman berjalan.",
      rows: dipinjam,
      meta: (r) => (
        <p className="mt-1 text-sm break-words text-gray-500">
          {r.ruangan} · Tgl kembali {formatTanggal(r.tglRencanaKembali)}
        </p>
      ),
      aksi: (r) =>
        bisaKembali ? (
          <ButtonLink href={`/peminjaman/${r.id}/pengembalian`} variant="secondary" block>
            Cek Pengembalian
          </ButtonLink>
        ) : null,
    },
  ];

  return (
    <div className="mt-6 space-y-6 lg:space-y-8">
      {sections.map((s) => (
        <section key={s.judul} aria-label={s.judul}>
          <SectionTitle>{s.judul}</SectionTitle>
          {s.rows.length === 0 ? (
            <EmptyState>{s.kosong}</EmptyState>
          ) : (
            <ul className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
              {s.rows.map((r) => (
                <PeminjamanCard key={r.id} row={r} kanan={s.kanan?.(r)} meta={s.meta(r)} aksi={s.aksi(r) ?? undefined} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
