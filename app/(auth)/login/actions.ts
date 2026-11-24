"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().max(254, "Email terlalu panjang.").pipe(z.email("Format email tidak valid.")),
  password: z.string().min(1, "Password wajib diisi.").max(72, "Password terlalu panjang."),
});

export type LoginState = { error?: string; email?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const parsed = schema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { error: "Email atau password salah.", email };
  }

  const { data: staff } = await supabase
    .from("staff_it")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!staff || staff.status !== "aktif") {
    await supabase.auth.signOut({ scope: "local" });
    return { error: "Akun Anda non-aktif. Hubungi administrator.", email };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
