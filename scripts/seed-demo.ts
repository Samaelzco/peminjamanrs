// Seed data demo (aman dijalankan ulang): npm run seed:demo
import { adminClient, ensureAccount, requireEnv } from "./lib/seed-utils";

const KATEGORI = [
  { nama: "Laptop", kode_prefix: "LPT" },
  { nama: "Proyektor", kode_prefix: "PRJ" },
  { nama: "Webcam", kode_prefix: "WCM" },
];

const ASET = [
  { kode_aset: "LPT-001", nama_aset: "Laptop Lenovo ThinkPad E14", prefix: "LPT" },
  { kode_aset: "LPT-002", nama_aset: "Laptop Lenovo ThinkPad E14", prefix: "LPT" },
  { kode_aset: "LPT-003", nama_aset: "Laptop ASUS ExpertBook B1", prefix: "LPT" },
  { kode_aset: "PRJ-001", nama_aset: "Proyektor Epson EB-X51", prefix: "PRJ" },
  { kode_aset: "PRJ-002", nama_aset: "Proyektor Epson EB-X51", prefix: "PRJ" },
  { kode_aset: "PRJ-003", nama_aset: "Proyektor BenQ MX560", prefix: "PRJ" },
  { kode_aset: "WCM-001", nama_aset: "Webcam Logitech C920", prefix: "WCM" },
  { kode_aset: "WCM-002", nama_aset: "Webcam Logitech C920", prefix: "WCM" },
];

async function main() {
  const supabase = adminClient();

  // Kategori: upsert berdasarkan nama (tidak mengubah yang sudah ada).
  const { error: katErr } = await supabase
    .from("kategori")
    .upsert(KATEGORI, { onConflict: "nama", ignoreDuplicates: true });
  if (katErr) throw katErr;

  const { data: kategori, error } = await supabase.from("kategori").select("id, kode_prefix");
  if (error) throw error;
  const katByPrefix = new Map(kategori.map((k) => [k.kode_prefix, k.id]));
  console.log(`✓ Kategori: ${KATEGORI.map((k) => k.kode_prefix).join(", ")}`);

  // Aset: hanya tambah kode yang belum ada.
  const { data: existing } = await supabase
    .from("aset")
    .select("kode_aset")
    .in("kode_aset", ASET.map((a) => a.kode_aset));
  const ada = new Set((existing ?? []).map((a) => a.kode_aset));
  const baru = ASET.filter((a) => !ada.has(a.kode_aset)).map((a) => {
    const kategori_id = katByPrefix.get(a.prefix);
    if (!kategori_id) throw new Error(`Kategori ${a.prefix} tidak ditemukan.`);
    return {
      kode_aset: a.kode_aset,
      nama_aset: a.nama_aset,
      kategori_id,
      kondisi: "baik" as const,
      status: "tersedia" as const,
    };
  });

  if (baru.length) {
    const { error: asetErr } = await supabase.from("aset").insert(baru);
    if (asetErr) throw asetErr;
  }
  console.log(`✓ Aset: ${baru.length} ditambahkan, ${ada.size} sudah ada.`);

  await ensureAccount(supabase, {
    email: requireEnv("SEED_SARPRAS_EMAIL"),
    password: requireEnv("SEED_SARPRAS_PASSWORD"),
    nama: requireEnv("SEED_SARPRAS_NAMA"),
    roleNama: "Sarana dan Prasarana",
  });
}

main().catch((err) => {
  console.error("Seed demo gagal:", err.message ?? err);
  process.exit(1);
});
