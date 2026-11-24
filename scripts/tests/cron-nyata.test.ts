// Uji pg_cron sungguhan (skenario 6): tunggu job tiap menit menandai terlambat. Memakan waktu ≤2 menit.
import { admin, check, cleanupUser, signIn, summary, tempUser } from "./helpers";
import { asetIds, bersihkan, DATA_PEMINJAM, unggahFoto } from "./fixtures";

const ASET = ["TI-CAM-001"];

async function main() {
  console.log("Uji pg_cron nyata (menunggu jadwal tiap menit)");
  const adm = await tempUser("Administrasi", "cadm");
  const sar = await tempUser("Sarana dan Prasarana", "csar");
  const dibuat: number[] = [];
  try {
    const a = await signIn(adm.email, adm.password);
    const s = await signIn(sar.email, sar.password);
    const [wcm1] = await asetIds(a, ASET);
    const now = Date.now();
    const { data, error } = await a.rpc("buat_peminjaman", {
      ...DATA_PEMINJAM,
      p_tgl_peminjaman: new Date(now - 2 * 3600_000).toISOString(),
      // Rencana kembali di masa depan dulu (yang sudah lewat saat dicatat langsung terlambat).
      p_tgl_rencana_kembali: new Date(now + 3600_000).toISOString(),
      p_aset_ids: [wcm1],
    });
    if (error) throw error;
    const pid = data![0].id;
    dibuat.push(pid);
    const { data: det } = await s.from("detail_peminjaman").select("id").eq("peminjaman_id", pid);
    const { data: rid } = await s.rpc("reservasi_id_kejadian", { p_jenis: "pemasangan", p_peminjaman_id: pid });
    const foto = await unggahFoto(s, "pemasangan", rid!, 1);
    const sp = await s.rpc("simpan_pemasangan", {
      p_peminjaman_id: pid, p_pemasangan_id: rid!,
      p_units: det!.map((d) => ({ detail_id: d.id, kondisi_keluar: "baik" })), p_foto: foto,
    });
    if (sp.error) throw sp.error;
    // Geser rencana kembali ke 1 menit lalu supaya ditandai oleh cron.
    const geser = await admin
      .from("peminjaman")
      .update({ tgl_rencana_kembali: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", pid);
    if (geser.error) throw geser.error;
    const mulai = new Date();
    console.log(`  Peminjaman dipasang ${mulai.toISOString()}, menunggu cron...`);

    let status = "dipinjam";
    let menandaiPada: Date | null = null;
    for (let i = 0; i < 18 && status === "dipinjam"; i++) {
      await new Promise((r) => setTimeout(r, 10_000));
      const { data: p } = await a.from("peminjaman").select("status").eq("id", pid).single();
      status = p!.status;
      if (status !== "dipinjam") menandaiPada = new Date();
    }

    await check("S6 (cron nyata): status jadi 'terlambat' dalam ≤1 menit", async () => {
      const menit = menandaiPada ? (menandaiPada.getTime() - mulai.getTime()) / 60000 : null;
      console.log(`  Terdeteksi setelah ±${menit?.toFixed(1)} menit`);
      return (status === "terlambat" && menit !== null && menit <= 1.5) || `status ${status}`;
    });
    await check("S6 (cron nyata): notifikasi terlambat muncul untuk Admin", async () => {
      const { data: n } = await a.from("notifikasi").select("pesan").eq("peminjaman_id", pid).eq("jenis", "terlambat");
      return n?.length === 1 || `jumlah ${n?.length}`;
    });
    await check("S6 (cron nyata): log 'oleh sistem (pg_cron)'", async () => {
      const { data: l } = await a.from("log_peminjaman").select("staff_id, keterangan").eq("peminjaman_id", pid).eq("status_baru", "terlambat");
      return (l?.[0]?.staff_id === null && !!l?.[0]?.keterangan?.includes("pg_cron")) || JSON.stringify(l);
    });
  } finally {
    await bersihkan(dibuat, ASET);
    await cleanupUser(adm.id);
    await cleanupUser(sar.id);
  }
  summary();
}

main().catch(async (e) => {
  console.error(e);
  await admin.from("aset").update({ status: "tersedia", kondisi: "baik" }).in("kode_aset", ASET);
  process.exit(1);
});
