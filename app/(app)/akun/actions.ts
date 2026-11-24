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
import { createAdminClient } from "@/lib/supabase/admin";
import { email as emailSchema, namaOrang, password as passwordSchema } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";

const baseSchema = z.object({
  nama: namaOrang("Nama"),
  email: emailSchema,
  role_id: z.coerce.number("Role wajib dipilih.").int().positive("Role wajib dipilih."),
});

const createSchema = baseSchema.extend({
  password: passwordSchema,
});

const updateSchema = baseSchema.extend({
  id: z.uuid(),
  password: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(passwordSchema.optional()),
});

export type AkunInput = z.input<typeof createSchema>;
export type AkunUpdateInput = z.input<typeof updateSchema>;

export async function createAkun(input: AkunInput): Promise<ActionResult> {
  return runAction(async () => {
    await authorize("user.create");
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return validationError(parsed.error);
    const { nama, email, password, role_id } = parsed.data;

    const supabase = await createClient();
    const { data: dup } = await supabase.from("staff_it").select("id").eq("email", email).maybeSingle();
    if (dup) return { ok: false, error: "Email sudah terdaftar." };

    const admin = createAdminClient();
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authErr || !created.user) {
      return {
        ok: false,
        error: authErr?.code === "email_exists" ? "Email sudah terdaftar." : `Gagal membuat akun: ${authErr?.message}`,
      };
    }

    // Insert profil memakai client user, sehingga RLS (user.create) ikut memeriksa.
    const { error } = await supabase
      .from("staff_it")
      .insert({ id: created.user.id, nama, email, role_id, status: "aktif" });
    if (error) {
      await admin.auth.admin.deleteUser(created.user.id);
      return { ok: false, error: dbErrorMessage(error) };
    }

    refresh();
    return { ok: true, message: `Akun ${email} berhasil dibuat.` };
  });
}

export async function updateAkun(input: AkunUpdateInput): Promise<ActionResult> {
  return runAction(async () => {
    await authorize("user.update");
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return validationError(parsed.error);
    const { id, nama, email, role_id, password } = parsed.data;

    const supabase = await createClient();
    const { data: before, error: beforeErr } = await supabase
      .from("staff_it")
      .select("email")
      .eq("id", id)
      .single();
    if (beforeErr || !before) return { ok: false, error: "Akun tidak ditemukan." };

    // Update profil dulu: RLS + trigger memeriksa izin dan aturan pengaman.
    const { error } = await supabase.from("staff_it").update({ nama, email, role_id }).eq("id", id);
    if (error) return { ok: false, error: dbErrorMessage(error) };

    if (email !== before.email || password) {
      const admin = createAdminClient();
      const { error: authErr } = await admin.auth.admin.updateUserById(id, {
        ...(email !== before.email ? { email, email_confirm: true } : {}),
        ...(password ? { password } : {}),
      });
      if (authErr) {
        // Kembalikan email profil supaya tetap sinkron dengan auth.
        if (email !== before.email) {
          await supabase.from("staff_it").update({ email: before.email }).eq("id", id);
        }
        return { ok: false, error: `Gagal memperbarui login: ${authErr.message}` };
      }
    }

    refresh();
    return { ok: true, message: "Data akun berhasil diperbarui." };
  });
}

export async function toggleStatusAkun(id: string, aktif: boolean): Promise<ActionResult> {
  return runAction(async () => {
    await authorize("user.toggle-status");
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "ID akun tidak valid." };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("staff_it")
      .update({ status: aktif ? "aktif" : "non_aktif" })
      .eq("id", id)
      .select("email")
      .single();
    if (error) return { ok: false, error: dbErrorMessage(error) };

    refresh();
    return {
      ok: true,
      message: `Akun ${data.email} ${aktif ? "diaktifkan" : "dinonaktifkan"}.`,
    };
  });
}
