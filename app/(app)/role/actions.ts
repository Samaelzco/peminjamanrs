"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  authorize,
  dbErrorMessage,
  runAction,
  validationError,
  type ActionResult,
} from "@/lib/action";
import { createClient } from "@/lib/supabase/server";

const roleSchema = z.object({
  nama: z.string().trim().min(1, "Nama role wajib diisi.").max(60),
  deskripsi: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => v || null),
});

const idSchema = z.coerce.number().int().positive();

export type RoleInput = z.input<typeof roleSchema>;

export async function createRole(input: RoleInput): Promise<ActionResult> {
  return runAction(async () => {
    await authorize("role.manage");
    const parsed = roleSchema.safeParse(input);
    if (!parsed.success) return validationError(parsed.error);

    const supabase = await createClient();
    const { error } = await supabase.from("roles").insert(parsed.data);
    if (error) {
      return { ok: false, error: error.code === "23505" ? "Nama role sudah dipakai." : dbErrorMessage(error) };
    }
    refresh();
    return { ok: true, message: `Role "${parsed.data.nama}" berhasil dibuat.` };
  });
}

export async function updateRole(id: number, input: RoleInput): Promise<ActionResult> {
  return runAction(async () => {
    await authorize("role.manage");
    const roleId = idSchema.parse(id);
    const parsed = roleSchema.safeParse(input);
    if (!parsed.success) return validationError(parsed.error);

    const supabase = await createClient();
    const { error } = await supabase.from("roles").update(parsed.data).eq("id", roleId);
    if (error) {
      return { ok: false, error: error.code === "23505" ? "Nama role sudah dipakai." : dbErrorMessage(error) };
    }
    refresh();
    return { ok: true, message: "Role berhasil diperbarui." };
  });
}

export async function deleteRole(id: number): Promise<ActionResult> {
  return runAction(async () => {
    await authorize("role.manage");
    const roleId = idSchema.parse(id);

    const supabase = await createClient();
    // Trigger guard_hapus_role menolak role yang masih dipakai user.
    const { data, error } = await supabase.from("roles").delete().eq("id", roleId).select("nama");
    if (error) return { ok: false, error: dbErrorMessage(error) };
    if (!data?.length) return { ok: false, error: "Role tidak ditemukan." };

    refresh();
    return { ok: true, message: `Role "${data[0].nama}" berhasil dihapus.` };
  });
}

export async function setRolePermission(
  roleId: number,
  permissionId: number,
  enabled: boolean,
): Promise<ActionResult> {
  return runAction(async () => {
    const user = await authorize("role.manage");
    const rid = idSchema.parse(roleId);
    const pid = idSchema.parse(permissionId);

    const supabase = await createClient();

    if (!enabled && rid === user.roleId) {
      const { data: perm } = await supabase.from("permissions").select("nama").eq("id", pid).single();
      if (perm?.nama === "role.manage") {
        return {
          ok: false,
          error: "Tidak dapat menonaktifkan permission role.manage pada role Anda sendiri.",
        };
      }
    }

    const { error } = enabled
      ? await supabase
          .from("role_permissions")
          .upsert({ role_id: rid, permission_id: pid }, { ignoreDuplicates: true })
      : await supabase.from("role_permissions").delete().match({ role_id: rid, permission_id: pid });
    if (error) return { ok: false, error: dbErrorMessage(error) };

    refresh();
    return { ok: true };
  });
}
