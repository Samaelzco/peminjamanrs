import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "flowbite-react";
import {
  HiOutlineArchiveBox,
  HiOutlineClipboardDocumentList,
  HiOutlineExclamationTriangle,
  HiOutlinePlus,
  HiOutlineTruck,
} from "react-icons/hi2";
import { LinkButton } from "@/components/link-button";
import { PageHeader } from "@/components/page-header";
import { PEMINJAMAN_ROW_SELECT, PeminjamanTable, toPeminjamanRow } from "@/components/peminjaman-table";
import { requireUser } from "@/lib/auth";
import type { StatusPeminjaman } from "@/lib/labels";
import { menuFor } from "@/lib/menu";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

type Section = { judul: string; deskripsi: string; status: StatusPeminjaman; kosong: string };

export default async function DashboardPage() {
  const user = await requireUser();
  const perms = user.permissions;
  if (!perms.includes("dashboard.view")) {
    const first = menuFor(perms)[0];
    if (first && first.href !== "/") redirect(first.href);
  }

  const supabase = await createClient();
  const { data: ringkasan } = await supabase.rpc("ringkasan_dashboard").single();

  // Tabel tindak lanjut sesuai permission.
  const sections: Section[] = [];
  if (perms.includes("pemasangan.create")) {
    sections.push({
      judul: "Menunggu Pemasangan",
      deskripsi: "Peminjaman diajukan yang perlu dipasang.",
      status: "diajukan",
      kosong: "Tidak ada peminjaman yang menunggu pemasangan.",
    });
  }
  if (perms.includes("peminjaman.view")) {
    sections.push(
      {
        judul: "Terlambat",
        deskripsi: "Melewati rencana kembali — perlu ditindaklanjuti.",
        status: "terlambat",
        kosong: "Tidak ada peminjaman terlambat.",
      },
      {
        judul: perms.includes("pemasangan.create") ? "Sedang Dipinjam" : "Peminjaman Berjalan",
        deskripsi: "Unit sedang dipakai peminjam.",
        status: "dipinjam",
        kosong: "Tidak ada peminjaman berjalan.",
      },
    );
  }

  const data = await Promise.all(
    sections.map((s) =>
      supabase
        .from("peminjaman")
        .select(PEMINJAMAN_ROW_SELECT)
        .eq("status", s.status)
        .order(s.status === "diajukan" ? "tgl_peminjaman" : "tgl_rencana_kembali")
        .limit(50),
    ),
  );

  const kartu = [
    { label: "Diajukan", nilai: ringkasan?.diajukan ?? 0, icon: HiOutlineClipboardDocumentList, warna: "bg-yellow-100 text-yellow-700" },
    { label: "Dipinjam", nilai: ringkasan?.dipinjam ?? 0, icon: HiOutlineTruck, warna: "bg-cyan-100 text-cyan-700" },
    { label: "Terlambat", nilai: ringkasan?.terlambat ?? 0, icon: HiOutlineExclamationTriangle, warna: "bg-red-100 text-red-700" },
    { label: "Aset Tersedia", nilai: ringkasan?.aset_tersedia ?? 0, icon: HiOutlineArchiveBox, warna: "bg-green-100 text-green-700" },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Selamat datang, ${user.nama} (${user.roleNama}).`}
        actions={
          perms.includes("peminjaman.create") ? (
            <LinkButton href="/peminjaman/baru">
              <HiOutlinePlus className="me-1.5 h-4 w-4" />
              Peminjaman Baru
            </LinkButton>
          ) : undefined
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kartu.map((k) => (
          <Card key={k.label}>
            <div className="flex items-center gap-4">
              <span className={`rounded-lg p-3 ${k.warna}`}>
                <k.icon className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm text-gray-500">{k.label}</p>
                <p className="text-2xl font-bold text-gray-900">{k.nilai}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-8">
        {sections.map((s, i) => (
          <section key={s.status}>
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-gray-900">
                {s.judul} <span className="text-sm font-normal text-gray-500">({data[i].data?.length ?? 0})</span>
              </h2>
              <p className="text-sm text-gray-500">{s.deskripsi}</p>
            </div>
            <PeminjamanTable rows={(data[i].data ?? []).map(toPeminjamanRow)} empty={s.kosong} />
          </section>
        ))}
      </div>
    </>
  );
}
