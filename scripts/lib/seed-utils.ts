import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/database.types";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Env ${name} belum diatur di .env.local`);
    process.exit(1);
  }
  return value;
}

export function adminClient() {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

type Admin = ReturnType<typeof adminClient>;

/** Buat akun (auth + staff_it) dengan role tertentu. Lewati kalau email sudah ada. */
export async function ensureAccount(
  supabase: Admin,
  opts: { email: string; password: string; nama: string; roleNama: string },
) {
  const email = opts.email.trim().toLowerCase();

  const { data: existing, error: existingErr } = await supabase
    .from("staff_it")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existing) {
    console.log(`• Akun ${email} sudah ada, dilewati.`);
    return;
  }

  const { data: role, error: roleErr } = await supabase
    .from("roles")
    .select("id")
    .eq("nama", opts.roleNama)
    .single();
  if (roleErr || !role) throw new Error(`Role "${opts.roleNama}" tidak ditemukan.`);

  // Akun auth mungkin sudah ada tanpa profil (mis. run sebelumnya gagal di tengah).
  let userId: string | undefined;
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: opts.password,
    email_confirm: true,
  });
  if (createErr) {
    if (createErr.code !== "email_exists") throw createErr;
    userId = await findAuthUserId(supabase, email);
  } else {
    userId = created.user.id;
  }
  if (!userId) throw new Error(`User auth untuk ${email} tidak ditemukan.`);

  const { error: insertErr } = await supabase
    .from("staff_it")
    .insert({ id: userId, nama: opts.nama, email, role_id: role.id, status: "aktif" });
  if (insertErr) throw insertErr;

  console.log(`✓ Akun ${email} (${opts.roleNama}) dibuat.`);
}

async function findAuthUserId(supabase: Admin, email: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found.id;
    if (data.users.length < 200) return undefined;
  }
  return undefined;
}
