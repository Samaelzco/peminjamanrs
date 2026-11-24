import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PermissionToggles } from "./permission-toggles";

export const metadata: Metadata = { title: "Atur Permission" };

const URUTAN_MODUL = [
  "Dashboard",
  "Akun",
  "Role",
  "Kategori",
  "Aset",
  "Peminjaman",
  "Pemasangan",
  "Pengembalian",
  "Riwayat",
];

export default async function RolePermissionPage({ params }: PageProps<"/role/[id]">) {
  const user = await requirePermission("role.view");
  const { id } = await params;
  const roleId = Number(id);
  if (!Number.isInteger(roleId) || roleId <= 0) notFound();

  const supabase = await createClient();
  const [{ data: role }, { data: permissions }, { data: aktif }] = await Promise.all([
    supabase.from("roles").select("id, nama, deskripsi").eq("id", roleId).maybeSingle(),
    supabase.from("permissions").select("id, nama, modul, deskripsi").order("id"),
    supabase.from("role_permissions").select("permission_id").eq("role_id", roleId),
  ]);
  if (!role) notFound();

  const aktifSet = new Set((aktif ?? []).map((a) => a.permission_id));
  const groups = URUTAN_MODUL.map((modul) => ({
    modul,
    items: (permissions ?? [])
      .filter((p) => p.modul === modul)
      .map((p) => ({ ...p, aktif: aktifSet.has(p.id) })),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <Link href="/role" className="mb-2 inline-block text-sm text-cyan-700 hover:underline">
        ← Kembali ke daftar role
      </Link>
      <PageHeader title={`Permission: ${role.nama}`} description={role.deskripsi ?? undefined} />
      <PermissionToggles
        roleId={role.id}
        isOwnRole={role.id === user.roleId}
        canManage={user.permissions.includes("role.manage")}
        groups={groups}
      />
    </>
  );
}
