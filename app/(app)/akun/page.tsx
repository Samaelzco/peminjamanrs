import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AkunTable } from "./akun-table";

export const metadata: Metadata = { title: "Kelola Akun" };

export default async function AkunPage() {
  const user = await requirePermission("user.view");
  const supabase = await createClient();

  const [{ data: akun, error }, { data: roles }] = await Promise.all([
    supabase
      .from("staff_it")
      .select("id, nama, email, status, role_id, created_at, roles(nama)")
      .order("nama"),
    supabase.from("roles").select("id, nama").order("nama"),
  ]);
  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader title="Kelola Akun" description="Akun hanya dapat dibuat oleh administrator." />
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
        currentUserId={user.id}
        canCreate={user.permissions.includes("user.create")}
        canUpdate={user.permissions.includes("user.update")}
        canToggle={user.permissions.includes("user.toggle-status")}
      />
    </>
  );
}
