// Uji data master di lapis database: npm run test:master
import { admin, check, cleanupUser, signIn, summary, tempUser } from "./helpers";

async function main() {
  console.log("Uji data master (database)");
  const adm = await tempUser("Administrasi", "madm");
  const sar = await tempUser("Sarana dan Prasarana", "msar");
  const cleanupAset: number[] = [];
  const cleanupKat: number[] = [];

  try {
    const a = await signIn(adm.email, adm.password);
    const s = await signIn(sar.email, sar.password);
    const { data: lpt } = await s.from("kategori").select("id").eq("kode_prefix", "LPT").single();

    await check("Kode aset otomatis: LPT berikutnya = LPT-00(n+1)", async () => {
      const { data: last } = await s
        .from("aset").select("kode_aset").like("kode_aset", "LPT-%").order("kode_aset", { ascending: false }).limit(1).single();
      const n = Number(last!.kode_aset.split("-")[1]) + 1;
      const { data, error } = await s
        .from("aset").insert({ kategori_id: lpt!.id, nama_aset: "Laptop Uji", kondisi: "baik", status: "tersedia" })
        .select("id, kode_aset").single();
      if (error) return error.message;
      cleanupAset.push(data.id);
      return data.kode_aset === `LPT-${String(n).padStart(3, "0")}` || `dapat ${data.kode_aset}`;
    });

    await check("Sarpras tidak bisa mengubah status ke 'dipinjam' secara manual", async () => {
      const { error } = await s.from("aset").update({ status: "dipinjam" }).eq("id", cleanupAset[0]);
      return error?.message.includes("alur peminjaman") || `error: ${error?.message}`;
    });

    await check("Sarpras bisa mengubah status dalam_perbaikan → tersedia", async () => {
      const { error: e1 } = await s.from("aset").update({ status: "dalam_perbaikan" }).eq("id", cleanupAset[0]);
      const { error: e2 } = await s.from("aset").update({ status: "tersedia" }).eq("id", cleanupAset[0]);
      return (!e1 && !e2) || (e1 ?? e2)!.message;
    });

    await check("Kode aset tidak dapat diubah", async () => {
      const { error } = await s.from("aset").update({ kode_aset: "LPT-999" }).eq("id", cleanupAset[0]);
      return !!error;
    });

    await check("Admin (tanpa aset.create) tidak bisa menambah aset", async () => {
      const { error } = await a
        .from("aset").insert({ kategori_id: lpt!.id, nama_aset: "X", kondisi: "baik", status: "tersedia" });
      return !!error;
    });

    await check("Kategori yang masih punya aset tidak bisa dihapus", async () => {
      const { error } = await s.from("kategori").delete().eq("id", lpt!.id);
      return error?.message.includes("masih memiliki") || `error: ${error?.message}`;
    });

    await check("Prefix kategori yang punya aset tidak bisa diubah", async () => {
      const { error } = await s.from("kategori").update({ kode_prefix: "LTP" }).eq("id", lpt!.id);
      return error?.message.includes("prefix") || `error: ${error?.message}`;
    });

    await check("Kategori kosong bisa dibuat, diubah prefix, lalu dihapus", async () => {
      const { data, error } = await s.from("kategori").insert({ nama: `Uji ${Date.now()}`, kode_prefix: "UJIX" }).select("id").single();
      if (error) return error.message;
      cleanupKat.push(data.id);
      const { error: e2 } = await s.from("kategori").update({ kode_prefix: "UJIY" }).eq("id", data.id);
      if (e2) return e2.message;
      const { error: e3 } = await s.from("kategori").delete().eq("id", data.id);
      return !e3 || e3.message;
    });

    await check("Admin bisa membaca aset (untuk peminjaman)", async () => {
      const { data } = await a.from("aset").select("id");
      return (data?.length ?? 0) >= 8;
    });
  } finally {
    for (const id of cleanupAset) await admin.from("aset").delete().eq("id", id);
    for (const id of cleanupKat) await admin.from("kategori").delete().eq("id", id);
    await cleanupUser(adm.id);
    await cleanupUser(sar.id);
  }
  summary();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
