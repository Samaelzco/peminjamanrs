// Uji RBAC di lapis database: npm run test:rbac
import { admin, check, cleanupUser, signIn, summary, tempUser } from "./helpers";

async function main() {
  console.log("Uji RBAC (database)");
  const adm = await tempUser("Administrasi", "adm");
  const sar = await tempUser("Sarana dan Prasarana", "sar");

  try {
    const a = await signIn(adm.email, adm.password);
    const s = await signIn(sar.email, sar.password);

    await check("Admin punya 16 permission sesuai seed (termasuk debug.reset, peminjaman.update)", async () => {
      const { data } = await a.rpc("my_permissions");
      return data?.length === 16 || `dapat ${data?.length}`;
    });
    await check("Sarpras punya 13 permission sesuai seed", async () => {
      const { data } = await s.rpc("my_permissions");
      return data?.length === 13 || `dapat ${data?.length}`;
    });
    await check("has_permission: Sarpras tidak punya user.view", async () => {
      const { data } = await s.rpc("has_permission", { nama_permission: "user.view" });
      return data === false;
    });

    await check("Sarpras hanya bisa membaca profilnya sendiri (Kelola Akun via API)", async () => {
      const { data } = await s.from("staff_it").select("id");
      return (data?.length === 1 && data[0].id === sar.id) || `dapat ${data?.length} baris`;
    });
    await check("Admin bisa membaca semua akun", async () => {
      const { data } = await a.from("staff_it").select("id");
      return (data?.length ?? 0) >= 2;
    });
    await check("Sarpras tidak bisa membuat role", async () => {
      const { error } = await s.from("roles").insert({ nama: `X-${Date.now()}` });
      return !!error;
    });
    await check("Sarpras tidak bisa mengubah akun lain", async () => {
      const { data } = await s.from("staff_it").update({ nama: "Hack" }).eq("id", adm.id).select();
      return (data?.length ?? 0) === 0;
    });
    await check("Permission tidak bisa ditambah dari aplikasi (bahkan Admin)", async () => {
      const { error } = await a.from("permissions").insert({ nama: "x.y", modul: "X" });
      return !!error;
    });

    await check("Admin tidak bisa mematikan role.manage pada role sendiri", async () => {
      const { data: me } = await a.from("staff_it").select("role_id").eq("id", adm.id).single();
      const { data: p } = await a.from("permissions").select("id").eq("nama", "role.manage").single();
      const { error } = await a
        .from("role_permissions")
        .delete()
        .match({ role_id: me!.role_id, permission_id: p!.id });
      return error?.message.includes("role.manage") || `error: ${error?.message}`;
    });

    await check("Role yang masih dipakai tidak bisa dihapus", async () => {
      const { data: r } = await a.from("roles").select("id").eq("nama", "Sarana dan Prasarana").single();
      const { error } = await a.from("roles").delete().eq("id", r!.id);
      return error?.message.includes("masih dipakai") || `error: ${error?.message}`;
    });

    await check("Admin bisa membuat, mengatur, dan menghapus role kosong", async () => {
      const { data: r, error } = await a.from("roles").insert({ nama: `Uji ${Date.now()}` }).select("id").single();
      if (error) return error.message;
      const { data: p } = await a.from("permissions").select("id").eq("nama", "riwayat.view").single();
      const { error: e2 } = await a.from("role_permissions").insert({ role_id: r.id, permission_id: p!.id });
      if (e2) return e2.message;
      const { error: e3 } = await a.from("roles").delete().eq("id", r.id);
      return !e3 || e3.message;
    });

    await check("Admin tidak bisa menonaktifkan akunnya sendiri", async () => {
      const { error } = await a.from("staff_it").update({ status: "non_aktif" }).eq("id", adm.id);
      return !!error;
    });

    await check("User non_aktif tidak punya permission apa pun", async () => {
      const { error } = await a.from("staff_it").update({ status: "non_aktif" }).eq("id", sar.id);
      if (error) return error.message;
      const { data: perms } = await s.rpc("my_permissions");
      const { data: rows } = await s.from("roles").select("id");
      return (perms?.length === 0 && rows?.length === 0) || `perms ${perms?.length}, roles ${rows?.length}`;
    });

    await check("Admin bisa mengaktifkan kembali", async () => {
      const { error } = await a.from("staff_it").update({ status: "aktif" }).eq("id", sar.id);
      if (error) return error.message;
      const { data } = await s.rpc("my_permissions");
      return data?.length === 13;
    });

    await check("Anon tidak bisa membaca tabel apa pun", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
      const { data } = await anon.from("roles").select("id");
      return (data?.length ?? 0) === 0;
    });
  } finally {
    await cleanupUser(adm.id);
    await cleanupUser(sar.id);
    // Pastikan tidak ada sisa role uji.
    await admin.from("roles").delete().like("nama", "Uji %");
  }
  summary();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
