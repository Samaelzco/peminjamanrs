import "server-only";
import { cache } from "react";
import { forbidden, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Permission } from "@/lib/permissions";

export type CurrentUser = {
  id: string;
  nama: string;
  email: string;
  roleId: number;
  roleNama: string;
  permissions: Permission[];
};

/** User yang sedang login (null kalau belum login / non-aktif). Di-cache per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return null;

  const [{ data: staff }, { data: perms }] = await Promise.all([
    supabase
      .from("staff_it")
      .select("id, nama, email, status, role_id, roles(nama)")
      .eq("id", uid)
      .maybeSingle(),
    supabase.rpc("my_permissions"),
  ]);

  if (!staff || staff.status !== "aktif") return null;

  return {
    id: staff.id,
    nama: staff.nama,
    email: staff.email,
    roleId: staff.role_id,
    roleNama: staff.roles?.nama ?? "-",
    permissions: (perms ?? []) as Permission[],
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Cek permission user yang sedang login. */
export async function can(permission: Permission): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user?.permissions.includes(permission);
}

/** Untuk halaman: tampilkan 403 kalau tidak punya permission. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.permissions.includes(permission)) forbidden();
  return user;
}
