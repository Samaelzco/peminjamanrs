import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Badge,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from "flowbite-react";
import { PageHeader } from "@/components/page-header";
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

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <h2 className="text-base font-semibold text-gray-900">Isi Database Saat Ini</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Stat label="Total peminjaman" nilai={peminjaman?.length ?? 0} />
              {perStatus.map((s) => (
                <Stat key={s.status} label={STATUS_PEMINJAMAN[s.status].label} nilai={s.jumlah} />
              ))}
              <Stat label="Foto" nilai={(fotoPasang ?? 0) + (fotoKembali ?? 0)} />
              <Stat label="Notifikasi" nilai={notif ?? 0} />
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-gray-900">Aset ({aset?.length ?? 0})</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeadCell>Kode</TableHeadCell>
                    <TableHeadCell>Nama</TableHeadCell>
                    <TableHeadCell>Status</TableHeadCell>
                    <TableHeadCell>Kondisi</TableHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody className="divide-y">
                  {(aset ?? []).map((a) => (
                    <TableRow key={a.kode_aset} className="bg-white">
                      <TableCell className="font-mono font-medium text-gray-900">{a.kode_aset}</TableCell>
                      <TableCell>{a.nama_aset}</TableCell>
                      <TableCell>
                        <Badge color={STATUS_ASET[a.status].color} className="w-fit">{STATUS_ASET[a.status].label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge color={KONDISI[a.kondisi].color} className="w-fit">{KONDISI[a.kondisi].label}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        <ResetPanel />
      </div>
    </>
  );
}

function Stat({ label, nilai }: { label: string; nilai: number }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900">{nilai}</p>
    </div>
  );
}
