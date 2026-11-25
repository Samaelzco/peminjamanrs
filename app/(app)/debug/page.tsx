import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardTitle, PageHeader, Pill, StatCard } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { debugAktif } from "@/lib/debug";
import { KONDISI, STATUS_ASET, STATUS_PEMINJAMAN, STATUS_PEMINJAMAN_LIST } from "@/lib/labels";
import { createAdminClient } from "@/lib/supabase/admin";
import { ResetPanel } from "./reset-panel";

export const metadata: Metadata = { title: "Debug" };

export default async function DebugPage() {
  if (!debugAktif()) notFound();
  await requirePermission("debug.reset");

  // Ringkasan dibaca dengan service role (halaman ini sudah dibatasi permission debug.reset).
  const admin = createAdminClient();
  const [{ data: peminjaman }, { data: aset }, { count: fotoPasang }, { count: fotoKembali }, { count: notif }] =
    await Promise.all([
      admin.from("peminjaman").select("status"),
      admin.from("aset").select("kode_aset, nama_aset, status, kondisi").order("kode_aset"),
      admin.from("foto_pemasangan").select("*", { count: "exact", head: true }),
      admin.from("foto_pengembalian").select("*", { count: "exact", head: true }),
      admin.from("notifikasi").select("*", { count: "exact", head: true }),
    ]);

  const perStatus = STATUS_PEMINJAMAN_LIST.map((s) => ({
    status: s,
    jumlah: (peminjaman ?? []).filter((p) => p.status === s).length,
  }));

  return (
    <>
      <PageHeader title="Debug" description="Alat bantu pengujian dan demo." />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-4">
        <div className="space-y-3 lg:space-y-4">
          <Card>
            <CardTitle className="mb-3">Isi Database Saat Ini</CardTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              <StatCard label="Total peminjaman" value={peminjaman?.length ?? 0} />
              {perStatus.map((s) => (
                <StatCard key={s.status} label={STATUS_PEMINJAMAN[s.status].label} value={s.jumlah} />
              ))}
              <StatCard label="Foto" value={(fotoPasang ?? 0) + (fotoKembali ?? 0)} />
              <StatCard label="Notifikasi" value={notif ?? 0} />
            </div>
          </Card>

          <Card>
            <CardTitle className="mb-2">Barang ({aset?.length ?? 0})</CardTitle>
            <ul className="divide-y divide-gray-100">
              {(aset ?? []).map((a) => (
                <li key={a.kode_aset} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                  <span className="font-mono font-semibold text-gray-900">{a.kode_aset}</span>
                  <span className="min-w-0 flex-1 break-words text-gray-600">{a.nama_aset}</span>
                  <Pill tone={STATUS_ASET[a.status].tone}>{STATUS_ASET[a.status].label}</Pill>
                  <Pill tone={KONDISI[a.kondisi].tone}>{KONDISI[a.kondisi].label}</Pill>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <ResetPanel />
      </div>
    </>
  );
}
