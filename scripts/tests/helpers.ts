import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/database.types";

export type Db = SupabaseClient<Database>;

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const admin: Db = createClient<Database>(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function signIn(email: string, password: string): Promise<Db> {
  const c = createClient<Database>(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login ${email} gagal: ${error.message}`);
  return c;
}

let passed = 0;
let failed = 0;

export async function check(name: string, fn: () => Promise<boolean | string>) {
  try {
    const res = await fn();
    if (res === true) {
      passed++;
      console.log(`  ✓ ${name}`);
    } else {
      failed++;
      console.log(`  ✗ ${name}${typeof res === "string" ? ` — ${res}` : ""}`);
    }
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name} — ${(err as Error).message}`);
  }
}

export function summary() {
  console.log(`\n${passed} lolos, ${failed} gagal`);
  if (failed > 0) process.exitCode = 1;
}

/** Buat user sementara dengan role tertentu (dibersihkan oleh cleanupUser). */
export async function tempUser(roleNama: string, tag: string) {
  const email = `test.${tag}.${Date.now()}@example.test`;
  const password = "Test-Pass-12345";
  const { data: role } = await admin.from("roles").select("id").eq("nama", roleNama).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const { error: e2 } = await admin
    .from("staff_it")
    .insert({ id: data.user.id, nama: `Test ${tag}`, email, role_id: role!.id });
  if (e2) throw e2;
  return { id: data.user.id, email, password };
}

export async function cleanupUser(id: string) {
  await admin.auth.admin.deleteUser(id); // staff_it ikut terhapus (on delete cascade)
}
