// Tampilkan isi tabel kategori & aset, lalu uji kode otomatis prefix bersama (aset uji dihapus lagi).
import { admin } from "./helpers";

async function main() {
  const { data: k, error } = await admin.from("kategori").select("id, nama, kode_prefix").order("id");
  if (error) throw error;
  console.log("KATEGORI");
  console.table(k);

  const { data: a } = await admin
    .from("aset")
    .select("kode_aset, nama_aset, kategori(nama), status, kondisi, deskripsi")
    .order("kode_aset");
  console.log("ASET");
  console.table(
    a!.map((x) => ({
      kode: x.kode_aset, nama: x.nama_aset, kategori: x.kategori?.nama,
      status: x.status, kondisi: x.kondisi, deskripsi: x.deskripsi,
    })),
  );

  if (process.argv.includes("--uji-kode")) {
    const id = (nama: string) => k!.find((x) => x.nama === nama)!.id;
    const tambah = async (kat: string) => {
      const { data, error: e } = await admin
        .from("aset")
        .insert({ kategori_id: id(kat), nama_aset: `Uji ${kat}`, kondisi: "baik", status: "tersedia" })
        .select("id, kode_aset")
        .single();
      if (e) throw e;
      return data;
    };
    const w = await tambah("Webcam");
    const c = await tambah("Conf-Cam");
    const l = await tambah("Laptop");
    console.log(`Uji kode otomatis: Webcam baru → ${w.kode_aset} | Conf-Cam berikutnya → ${c.kode_aset} | Laptop baru → ${l.kode_aset}`);
    await admin.from("aset").delete().in("id", [w.id, c.id, l.id]);
    const { count } = await admin.from("aset").select("*", { count: "exact", head: true });
    console.log(`Aset uji dihapus kembali; total aset = ${count}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
