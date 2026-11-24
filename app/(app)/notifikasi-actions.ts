"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function bacaNotifikasi(id: number) {
  const user = await getCurrentUser();
  if (!user) return;
  const nid = z.coerce.number().int().positive().parse(id);
  const supabase = await createClient();
  // RLS hanya mengizinkan notifikasi milik sendiri.
  await supabase.from("notifikasi").update({ sudah_dibaca: true }).eq("id", nid).eq("user_id", user.id);
  refresh();
}

export async function bacaSemuaNotifikasi() {
  const user = await getCurrentUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase.rpc("baca_semua_notifikasi");
  refresh();
}
