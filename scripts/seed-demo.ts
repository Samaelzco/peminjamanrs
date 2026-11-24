// Seed data demo (aman dijalankan ulang): npm run seed:demo
import { adminClient, ensureAccount, requireEnv } from "./lib/seed-utils";

const KATEGORI = [
  { nama: "Laptop", kode_prefix: "TI-LPT" },
  { nama: "Proyektor", kode_prefix: "TI-PRJ" },
  { nama: "Webcam", kode_prefix: "TI-CAM" },
  { nama: "Conf-Cam", kode_prefix: "TI-CAM" }, // berbagi prefix & nomor urut dengan Webcam
];

// kode_aset ditulis persis (tidak dibuat otomatis). Semua di-seed tersedia/baik.
const ASET = [
  { kode_aset: "TI-LPT-001", nama_aset: "Lenovo ThinkPad L14 Gen 3", kategori: "Laptop", deskripsi: "i5 12th, 16GB, 512GB, Win11, charger 65W, tas" },
  { kode_aset: "TI-LPT-002", nama_aset: "Dell Latitude 3420", kategori: "Laptop", deskripsi: "i5 11th, 8GB, 256GB, Win11, adaptor 65W, tas, mouse" },
  { kode_aset: "TI-LPT-003", nama_aset: "ASUS ExpertBook B1400", kategori: "Laptop", deskripsi: "i3 11th, 8GB, 256GB, Win10, charger 65W, tas" },
  { kode_aset: "TI-LPT-004", nama_aset: "HP ProBook 440 G8", kategori: "Laptop", deskripsi: "i5 11th, 16GB, 512GB, charger 65W" },
  { kode_aset: "TI-PRJ-001", nama_aset: "Epson EB-X500", kategori: "Proyektor", deskripsi: "3600 lumens, XGA, HDMI/VGA, kabel power, HDMI 5m, remote, tas" },
  { kode_aset: "TI-PRJ-002", nama_aset: "BenQ MX560", kategori: "Proyektor", deskripsi: "4000 lumens, XGA, dual HDMI, kabel power, HDMI 10m, tas" },
  { kode_aset: "TI-CAM-001", nama_aset: "Logitech C922 Pro", kategori: "Webcam", deskripsi: "1080p 30fps, dual stereo mic, tripod mini, pouch" },
  { kode_aset: "TI-CAM-002", nama_aset: "Logitech MeetUp Conf", kategori: "Conf-Cam", deskripsi: "4K 120° FOV, 3-mic, speakerphone, remote, USB 5m, adaptor" },
];

// Data demo versi lama yang diganti.
const ASET_LAMA = ["LPT-001", "LPT-002", "LPT-003", "PRJ-001", "PRJ-002", "PRJ-003", "WCM-001", "WCM-002"];

type Db = ReturnType<typeof adminClient>;

async function hapusDataLama(supabase: Db) {
  const { data: lama, error } = await supabase.from("aset").select("id, kode_aset").in("kode_aset", ASET_LAMA);
  if (error) throw error;
  if (!lama?.length) return 0;

  // Jangan hapus aset lama yang punya riwayat peminjaman.
  const ids = lama.map((a) => a.id);
  const { data: dipakai, error: e2 } = await supabase
    .from("detail_peminjaman")
    .select("aset(kode_aset), peminjaman(kode_peminjaman, status)")
    .in("aset_id", ids);
  if (e2) throw e2;
  const { count: diganti } = await supabase
    .from("penggantian_unit")
    .select("*", { count: "exact", head: true })
    .or(`aset_lama_id.in.(${ids.join(",")}),aset_baru_id.in.(${ids.join(",")})`);

  if (dipakai?.length || diganti) {
    const daftar = [...new Set((dipakai ?? []).map((d) => `${d.aset?.kode_aset} → ${d.peminjaman?.kode_peminjaman} (${d.peminjaman?.status})`))];
    throw new Error(
      `Aset demo lama masih dipakai peminjaman, seed dihentikan tanpa mengubah data:\n  - ${daftar.join("\n  - ")}` +
        (diganti ? `\n  - ${diganti} catatan penggantian unit` : "") +
        "\nHapus/reset transaksi dulu (mis. lewat halaman /debug), lalu jalankan ulang.",
    );
  }

  const { error: e3 } = await supabase.from("aset").delete().in("id", ids);
  if (e3) throw e3;
  return ids.length;
}

async function upsertKategori(supabase: Db) {
  const { data: ada, error } = await supabase.from("kategori").select("id, nama, kode_prefix");
  if (error) throw error;
  const hasil = new Map<string, number>();

  for (const k of KATEGORI) {
    const lama = ada?.find((x) => x.nama === k.nama);
    if (!lama) {
      const { data, error: e } = await supabase.from("kategori").insert(k).select("id").single();
      if (e) throw e;
      hasil.set(k.nama, data.id);
      console.log(`  + kategori ${k.nama} (${k.kode_prefix})`);
    } else {
      if (lama.kode_prefix !== k.kode_prefix) {
        const { error: e } = await supabase.from("kategori").update({ kode_prefix: k.kode_prefix }).eq("id", lama.id);
        if (e) throw new Error(`Gagal mengubah prefix kategori ${k.nama}: ${e.message}`);
        console.log(`  ~ kategori ${k.nama}: prefix ${lama.kode_prefix} → ${k.kode_prefix}`);
      } else {
        console.log(`  = kategori ${k.nama} (${k.kode_prefix})`);
      }
      hasil.set(k.nama, lama.id);
    }
  }
  return hasil;
}

async function upsertAset(supabase: Db, kategoriId: Map<string, number>) {
  const { data: ada, error } = await supabase
    .from("aset")
    .select("id, kode_aset, kategori_id")
    .in("kode_aset", ASET.map((a) => a.kode_aset));
  if (error) throw error;

  // Aset yang sedang terikat peminjaman aktif tidak diubah status/kondisinya.
  const { data: aktif } = await supabase
    .from("detail_peminjaman")
    .select("aset_id, peminjaman!inner(status)")
    .in("aset_id", (ada ?? []).map((a) => a.id).concat(-1))
    .in("peminjaman.status", ["diajukan", "dipinjam", "terlambat"]);
  const terikat = new Set((aktif ?? []).map((d) => d.aset_id));

  for (const a of ASET) {
    const kid = kategoriId.get(a.kategori)!;
    const lama = ada?.find((x) => x.kode_aset === a.kode_aset);
    if (!lama) {
      const { error: e } = await supabase.from("aset").insert({
        kode_aset: a.kode_aset, nama_aset: a.nama_aset, kategori_id: kid, deskripsi: a.deskripsi,
        kondisi: "baik", status: "tersedia",
      });
      if (e) throw new Error(`Gagal menambah ${a.kode_aset}: ${e.message}`);
      console.log(`  + aset ${a.kode_aset} ${a.nama_aset}`);
      continue;
    }
    if (lama.kategori_id !== kid) {
      throw new Error(`Aset ${a.kode_aset} sudah ada dengan kategori lain; kategori aset tidak dapat diubah.`);
    }
    const ubah = terikat.has(lama.id)
      ? { nama_aset: a.nama_aset, deskripsi: a.deskripsi }
      : { nama_aset: a.nama_aset, deskripsi: a.deskripsi, kondisi: "baik" as const, status: "tersedia" as const };
    const { error: e } = await supabase.from("aset").update(ubah).eq("id", lama.id);
    if (e) throw new Error(`Gagal memperbarui ${a.kode_aset}: ${e.message}`);
    console.log(`  ~ aset ${a.kode_aset} diperbarui${terikat.has(lama.id) ? " (status dibiarkan: sedang dipinjam)" : ""}`);
  }
}

async function main() {
  const supabase = adminClient();

  const dihapus = await hapusDataLama(supabase);
  if (dihapus) console.log(`✓ ${dihapus} aset demo lama dihapus`);

  console.log("Kategori:");
  const kategoriId = await upsertKategori(supabase);

  console.log("Aset:");
  await upsertAset(supabase, kategoriId);

  // Kategori demo lama yang kosong (mis. prefix LPT/PRJ/WCM dengan nama lain) dibiarkan;
  // kategori bernama sama sudah diperbarui prefix-nya di atas.

  await ensureAccount(supabase, {
    email: requireEnv("SEED_SARPRAS_EMAIL"),
    password: requireEnv("SEED_SARPRAS_PASSWORD"),
    nama: requireEnv("SEED_SARPRAS_NAMA"),
    roleNama: "Sarana dan Prasarana",
  });
  console.log("✓ Seed demo selesai.");
}

main().catch((err) => {
  console.error("Seed demo gagal:", err.message ?? err);
  process.exit(1);
});
