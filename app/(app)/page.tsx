import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { menuFor } from "@/lib/menu";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user.permissions.includes("dashboard.view")) {
    const first = menuFor(user.permissions)[0];
    if (first && first.href !== "/") redirect(first.href);
  }

  return (
    <>
      <PageHeader title="Dashboard" description={`Selamat datang, ${user.nama}.`} />
      <p className="text-sm text-gray-500">Ringkasan peminjaman akan tampil di sini (Fase 6).</p>
    </>
  );
}
