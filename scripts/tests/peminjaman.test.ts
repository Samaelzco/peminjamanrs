// Uji alur peminjaman di lapis database (skenario 1–4 + pembatalan): npm run test:peminjaman
import { admin, check, cleanupUser, signIn, summary, tempUser, type Db } from "./helpers";

const DATA = {
  p_nama_peminjam: "Uji Peminjam",
  p_divisi_peminjam: "Instalasi Uji",
  p_kontak_peminjam: "081234567890",
  p_ruangan: "Ruang Rapat Uji",
  p_keperluan: "Pengujian otomatis",
};

function jadwal(jamMulai = 0, durasiJam = 4) {
  const start = new Date(Date.now() + jamMulai * 3600_000);
  const end = new Date(start.getTime() + durasiJam * 3600_000);
  return { p_tgl_peminjaman: start.toISOString(), p_tgl_rencana_kembali: end.toISOString() };
}

export async function kategoriId(db: Db, nama: string) {
  const { data } = await db.from("kategori").select("id").eq("nama", nama).single();
  return data!.id;
}

async function main() {
  console.log("Uji peminjaman (database)");
  const adm = await tempUser("Administrasi", "padm");
  const adm2 = await tempUser("Administrasi", "padm2");
  const sar = await tempUser("Sarana dan Prasarana", "psar");
  const dibuat: number[] = [];

  try {
    const a = await signIn(adm.email, adm.password);
    const a2 = await signIn(adm2.email, adm2.password);
    const s = await signIn(sar.email, sar.password);
    const LPT = await kategoriId(a, "Laptop");
    const PRJ = await kategoriId(a, "Proyektor");

    let pjm1: { id: number; kode_peminjaman: string } | undefined;

    await check("S1: 1 laptop + 1 proyektor → TI-LPT-001 & TI-PRJ-001 (kode terkecil)", async () => {
      const { data: l, error: e1 } = await a.rpc("ambil_unit_tersedia", { p_kategori_id: LPT, p_jumlah: 1 });
      const { data: p, error: e2 } = await a.rpc("ambil_unit_tersedia", { p_kategori_id: PRJ, p_jumlah: 1 });
      if (e1 || e2) return (e1 ?? e2)!.message;
      return (l![0].kode_aset === "TI-LPT-001" && p![0].kode_aset === "TI-PRJ-001") || `${l![0].kode_aset}, ${p![0].kode_aset}`;
    });

    await check("S1: simpan → status 'diajukan', aset tetap 'tersedia'", async () => {
      const { data: units } = await a.from("aset").select("id").in("kode_aset", ["TI-LPT-001", "TI-PRJ-001"]);
      const { data, error } = await a.rpc("buat_peminjaman", { ...DATA, ...jadwal(), p_aset_ids: units!.map((u) => u.id) });
      if (error) return error.message;
      pjm1 = data![0];
      dibuat.push(pjm1.id);
      const { data: p } = await a.from("peminjaman").select("status").eq("id", pjm1.id).single();
      const { data: as } = await a.from("aset").select("status").in("kode_aset", ["TI-LPT-001", "TI-PRJ-001"]);
      return (p?.status === "diajukan" && as!.every((x) => x.status === "tersedia")) || `status ${p?.status}`;
    });

    await check("S1: notifikasi dibuat untuk user dengan pemasangan.create", async () => {
      const { data } = await s.from("notifikasi").select("pesan").eq("peminjaman_id", pjm1!.id);
      return (data?.length === 1 && data[0].pesan.includes(pjm1!.kode_peminjaman)) || `dapat ${data?.length}`;
    });

    await check("S2: minta 4 proyektor, hanya 1 tersisa → ditolak semua dengan pesan", async () => {
      const { data, error } = await a.rpc("ambil_unit_tersedia", { p_kategori_id: PRJ, p_jumlah: 4 });
      return (error?.message === "Hanya tersedia 1 unit Proyektor." && !data) || `error: ${error?.message}`;
    });

    await check("S3: unit di peminjaman 'diajukan' tidak muncul sebagai pilihan", async () => {
      const { data } = await a.rpc("aset_tersedia", { p_kategori_id: LPT });
      return !data!.some((x) => x.kode_aset === "TI-LPT-001") || "TI-LPT-001 masih muncul";
    });

    await check("S3: menyimpan unit yang sudah terikat ditolak dengan menyebut kodenya", async () => {
      const { data: u } = await a.from("aset").select("id").eq("kode_aset", "TI-LPT-001").single();
      const { error } = await a.rpc("buat_peminjaman", { ...DATA, ...jadwal(), p_aset_ids: [u!.id] });
      return error?.message.includes("TI-LPT-001") || `error: ${error?.message}`;
    });

    await check("S4: dua penyimpanan bersamaan untuk unit sama → hanya satu berhasil", async () => {
      const { data: u } = await a.from("aset").select("id").eq("kode_aset", "TI-LPT-002").single();
      const args = { ...DATA, ...jadwal(), p_aset_ids: [u!.id] };
      const [r1, r2] = await Promise.all([a.rpc("buat_peminjaman", args), a2.rpc("buat_peminjaman", args)]);
      for (const r of [r1, r2]) if (r.data?.[0]) dibuat.push(r.data[0].id);
      const ok = [r1, r2].filter((r) => !r.error).length;
      const gagal = [r1, r2].find((r) => r.error);
      return (ok === 1 && !!gagal?.error?.message.includes("TI-LPT-002")) || `berhasil ${ok}: ${gagal?.error?.message}`;
    });

    await check("Kode peminjaman berurutan (PJM-xxxx)", async () => {
      const { data } = await a.from("peminjaman").select("kode_peminjaman").in("id", dibuat).order("id");
      const nums = data!.map((d) => Number(d.kode_peminjaman.slice(4)));
      return (nums.every((n, i) => i === 0 || n === nums[i - 1] + 1) && data!.every((d) => /^PJM-\d{4,}$/.test(d.kode_peminjaman))) || JSON.stringify(data);
    });

    await check("Tanggal rencana kembali harus setelah tanggal peminjaman", async () => {
      const { data: u } = await a.from("aset").select("id").eq("kode_aset", "TI-LPT-003").single();
      const { error } = await a.rpc("buat_peminjaman", { ...DATA, ...jadwal(0, -1), p_aset_ids: [u!.id] });
      return !!error?.message.includes("setelah");
    });

    await check("Sarpras (tanpa peminjaman.create) tidak bisa membuat peminjaman", async () => {
      const { data: u } = await a.from("aset").select("id").eq("kode_aset", "TI-LPT-003").single();
      const { error } = await s.rpc("buat_peminjaman", { ...DATA, ...jadwal(), p_aset_ids: [u!.id] });
      return !!error;
    });

    await check("Client tidak bisa mengubah peminjaman langsung (hanya lewat RPC)", async () => {
      const { error } = await a.from("peminjaman").update({ status: "selesai" }).eq("id", pjm1!.id);
      return !!error;
    });

    await check("S7 (pembatalan): 'diajukan' → 'dibatalkan', unit bebas lagi", async () => {
      const { error } = await a.rpc("batalkan_peminjaman", { p_peminjaman_id: pjm1!.id });
      if (error) return error.message;
      const { data } = await a.rpc("aset_tersedia", { p_kategori_id: LPT });
      return data!.some((x) => x.kode_aset === "TI-LPT-001") || "TI-LPT-001 belum bebas";
    });

    await check("Pembatalan kedua ditolak (transisi tidak sah)", async () => {
      const { error } = await a.rpc("batalkan_peminjaman", { p_peminjaman_id: pjm1!.id });
      return !!error?.message.includes("diajukan");
    });

    await check("Log status tercatat (diajukan → dibatalkan)", async () => {
      const { data } = await a.from("log_peminjaman").select("status_baru").eq("peminjaman_id", pjm1!.id).order("id");
      return JSON.stringify(data?.map((d) => d.status_baru)) === '["diajukan","dibatalkan"]' || JSON.stringify(data);
    });

    await check("Aset dengan riwayat peminjaman tidak bisa dihapus", async () => {
      const { data: u } = await a.from("aset").select("id").eq("kode_aset", "TI-LPT-001").single();
      const { error } = await s.from("aset").delete().eq("id", u!.id);
      return error?.message.includes("riwayat") || `error: ${error?.message}`;
    });
  } finally {
    if (dibuat.length) await admin.from("peminjaman").delete().in("id", dibuat);
    await cleanupUser(adm.id);
    await cleanupUser(adm2.id);
    await cleanupUser(sar.id);
  }
  summary();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
