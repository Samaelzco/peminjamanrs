import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, cn } from "@/components/ui";
import { requireAnyPermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RoleTable } from "../role/role-table";
import { AkunTable } from "./akun-table";

export const metadata: Metadata = { title: "Kelola Akun" };

export default async function AkunPage({ searchParams }: PageProps<"/akun">) {
  const user = await requireAnyPermission("user.view", "role.view");
  const lihatAkun = user.permissions.includes("user.view");
  const lihatRole = user.permissions.includes("role.view");
  const { tab: tabParam } = await searchParams;
  const tab = (tabParam === "role" && lihatRole) || !lihatAkun ? "role" : "akun";

  return (
    <>
      <PageHeader title="Kelola Akun" description="Admin membuat dan mengatur akun pengguna" />

      {lihatAkun && lihatRole && (
        <nav aria-label="Bagian Kelola Akun" className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-gray-200/70 p-1 sm:inline-grid sm:w-auto">
          {[
            { id: "akun", label: "Akun", href: "/akun" },
            { id: "role", label: "Role & Permission", href: "/akun?tab=role" },
          ].map((t) => (
            <Link
              key={t.id}
              href={t.href}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn(
                "grid min-h-10 place-items-center rounded-lg px-4 text-sm font-semibold transition-colors duration-200",
                tab === t.id ? "bg-white text-brand-800 shadow-sm" : "text-gray-600 hover:text-gray-900",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}

      {tab === "akun" ? <TabAkun userId={user.id} permissions={user.permissions} /> : <TabRole roleId={user.roleId} permissions={user.permissions} />}
    </>
  );
}

async function TabAkun({ userId, permissions }: { userId: string; permissions: readonly string[] }) {
  const supabase = await createClient();
  const [{ data: akun, error }, { data: roles }] = await Promise.all([
    supabase.from("staff_it").select("id, nama, email, status, role_id, created_at, roles(nama)").order("nama"),
    supabase.from("roles").select("id, nama").order("nama"),
  ]);
  if (error) throw new Error(error.message);

  return (
    <AkunTable
      akun={(akun ?? []).map((a) => ({
        id: a.id,
        nama: a.nama,
        email: a.email,
        status: a.status,
        roleId: a.role_id,
        roleNama: a.roles?.nama ?? "-",
        createdAt: a.created_at,
      }))}
      roles={roles ?? []}
      currentUserId={userId}
      canCreate={permissions.includes("user.create")}
      canUpdate={permissions.includes("user.update")}
      canToggle={permissions.includes("user.toggle-status")}
    />
  );
}

async function TabRole({ roleId, permissions }: { roleId: number; permissions: readonly string[] }) {
  const supabase = await createClient();
  const { data: roles, error } = await supabase
    .from("roles")
    .select("id, nama, deskripsi, staff_it(count), role_permissions(count)")
    .order("nama");
  if (error) throw new Error(error.message);

  return (
    <RoleTable
      roles={(roles ?? []).map((r) => ({
        id: r.id,
        nama: r.nama,
        deskripsi: r.deskripsi,
        jumlahAkun: r.staff_it[0]?.count ?? 0,
        jumlahPermission: r.role_permissions[0]?.count ?? 0,
      }))}
      currentRoleId={roleId}
      canManage={permissions.includes("role.manage")}
    />
  );
}
