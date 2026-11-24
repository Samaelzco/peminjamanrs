import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RoleTable } from "./role-table";

export const metadata: Metadata = { title: "Role & Permission" };

export default async function RolePage() {
  const user = await requirePermission("role.view");
  const supabase = await createClient();

  const { data: roles, error } = await supabase
    .from("roles")
    .select("id, nama, deskripsi, staff_it(count), role_permissions(count)")
    .order("nama");
  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader
        title="Role & Permission"
        description="Permission ditetapkan oleh sistem. Atur permission setiap role lewat tombol Atur Permission."
      />
      <RoleTable
        roles={(roles ?? []).map((r) => ({
          id: r.id,
          nama: r.nama,
          deskripsi: r.deskripsi,
          jumlahAkun: r.staff_it[0]?.count ?? 0,
          jumlahPermission: r.role_permissions[0]?.count ?? 0,
        }))}
        currentRoleId={user.roleId}
        canManage={user.permissions.includes("role.manage")}
      />
    </>
  );
}
