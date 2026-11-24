import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import type { z } from "zod";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export class ActionError extends Error {}

/** Wajib dipanggil di awal setiap server action. */
export async function authorize(permission: Permission | Permission[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ActionError("Sesi Anda berakhir. Silakan login kembali.");
  const needed = Array.isArray(permission) ? permission : [permission];
  if (!needed.some((p) => user.permissions.includes(p))) {
    throw new ActionError("Anda tidak punya izin untuk melakukan aksi ini.");
  }
  return user;
}

export function validationError(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, error: "Periksa kembali isian Anda.", fieldErrors };
}

/** Ubah error Postgres/Supabase menjadi pesan yang ramah. */
export function dbErrorMessage(error: Pick<PostgrestError, "code" | "message">): string {
  switch (error.code) {
    case "P0001": // raise exception dari fungsi/trigger kita
      return error.message;
    case "23505":
      return "Data dengan nilai tersebut sudah ada.";
    case "23503":
      return "Data masih dipakai oleh data lain sehingga tidak dapat diproses.";
    case "42501":
      return error.message.startsWith("Anda")
        ? error.message
        : "Anda tidak punya izin untuk melakukan aksi ini.";
    default:
      return error.message || "Terjadi kesalahan pada database.";
  }
}

/** Bungkus eksekusi action supaya ActionError jadi { ok: false }. */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, error: err.message };
    throw err;
  }
}
