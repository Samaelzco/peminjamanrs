// Uji status Terlambat (fungsi cron), notifikasi, perpanjangan, dashboard (skenario 6 & 7).
import { admin, check, cleanupUser, signIn, summary, tempUser, type Db } from "./helpers";
import { asetIds, bersihkan, DATA_PEMINJAM, unggahFoto } from "./fixtures";

const ASET_UJI = ["TI-LPT-003", "TI-CAM-002"];

async function pinjamDanPasang(a: Db, s: Db, ids: number[], mulaiJam: number, kembaliJam: number) {
  const now = Date.now();
  const { data, error } = await a.rpc("buat_peminjaman", {
    ...DATA_PEMINJAM,
    p_tgl_peminjaman: new Date(now + mulaiJam * 3600_000).toISOString(),
    p_tgl_rencana_kembali: new Date(now + kembaliJam * 3600_000).toISOString(),
    p_aset_ids: ids,
  });
  if (error) throw error;
  const pid = data![0].id;
  const { data: det } = await s.from("detail_peminjaman").select("id").eq("peminjaman_id", pid);
  const { data: rid } = await s.rpc("reservasi_id_kejadian", { p_jenis: "pemasangan", p_peminjaman_id: pid });
  const foto = await unggahFoto(s, "pemasangan", rid!, 1);
  const { error: e2 } = await s.rpc("simpan_pemasangan", {
    p_peminjaman_id: pid, p_pemasangan_id: rid!,
    p_units: det!.map((d) => ({ detail_id: d.id, kondisi_keluar: "baik" })), p_foto: foto,
  });
  if (e2) throw e2;
  return pid;
}

async function main() {
  console.log("Uji terlambat, notifikasi, perpanjangan, dashboard");
  const adm = await tempUser("Administrasi", "xadm");
  const sar = await tempUser("Sarana dan Prasarana", "xsar");
  const dibuat: number[] = [];

  try {
    const a = await signIn(adm.email, adm.password);
    const s = await signIn(sar.email, sar.password);
    const [lpt3, wcm2] = await asetIds(a, ASET_UJI);

    // Rencana kembali 1 menit yang lalu.
    const pid = await pinjamDanPasang(a, s, [lpt3, wcm2], -3, -1 / 60);
    dibuat.push(pid);

    await check("Dashboard: ringkasan menghitung 1 dipinjam", async () => {
      const { data } = await a.rpc("ringkasan_dashboard").single();
      return (data!.dipinjam >= 1) || JSON.stringify(data);
    });

    await check("User aplikasi tidak bisa memanggil tandai_terlambat langsung", async () => {
      const { error } = await a.rpc("tandai_terlambat");
      return !!error;
    });

    await check("S6: fungsi cron menandai 'dipinjam' yang lewat jadi 'terlambat'", async () => {
      const { error } = await admin.rpc("tandai_terlambat");
      if (error) return error.message;
      const { data } = await a.from("peminjaman").select("status").eq("id", pid).single();
      return data!.status === "terlambat" || data!.status;
    });

    await check("S6: notifikasi terlambat untuk user peminjaman.view (Admin & Sarpras)", async () => {
      const { data: na } = await a.from("notifikasi").select("pesan").eq("peminjaman_id", pid).eq("jenis", "terlambat");
      const { data: ns } = await s.from("notifikasi").select("pesan").eq("peminjaman_id", pid).eq("jenis", "terlambat");
      return (na?.length === 1 && ns?.length === 1 && na[0].pesan.includes("terlambat")) || `${na?.length}/${ns?.length}`;
    });

    await check("S6: cron dijalankan ulang → tidak ada notifikasi ganda", async () => {
      await admin.rpc("tandai_terlambat");
      const { count } = await admin.from("notifikasi").select("*", { count: "exact", head: true })
        .eq("peminjaman_id", pid).eq("jenis", "terlambat").eq("user_id", adm.id);
      return count === 1 || `count ${count}`;
    });

    await check("Log terlambat tercatat 'oleh sistem'", async () => {
      const { data } = await a.from("log_peminjaman").select("staff_id, keterangan").eq("peminjaman_id", pid).eq("status_baru", "terlambat");
      return (data?.length === 1 && data[0].staff_id === null) || JSON.stringify(data);
    });

    await check("Perpanjangan ditolak tanpa alasan / tanggal lampau", async () => {
      const r1 = await a.rpc("perpanjang_peminjaman", {
        p_peminjaman_id: pid, p_tgl_rencana_kembali: new Date(Date.now() + 86400_000).toISOString(), p_alasan: "",
      });
      const r2 = await a.rpc("perpanjang_peminjaman", {
        p_peminjaman_id: pid, p_tgl_rencana_kembali: new Date(Date.now() - 60_000).toISOString(), p_alasan: "x",
      });
      return (!!r1.error && !!r2.error) || "tidak ditolak";
    });

    await check("Sarpras (tanpa peminjaman.extend) tidak bisa memperpanjang", async () => {
      const { error } = await s.rpc("perpanjang_peminjaman", {
        p_peminjaman_id: pid, p_tgl_rencana_kembali: new Date(Date.now() + 86400_000).toISOString(), p_alasan: "x",
      });
      return !!error;
    });

    let baruId = 0;
    await check("S7: perpanjang yang terlambat → lama 'selesai', baru 'dipinjam' + perpanjangan_dari", async () => {
      const { data, error } = await a.rpc("perpanjang_peminjaman", {
        p_peminjaman_id: pid, p_tgl_rencana_kembali: new Date(Date.now() + 2 * 86400_000).toISOString(),
        p_alasan: "Acara diperpanjang 2 hari",
      });
      if (error) return error.message;
      baruId = data![0].id;
      dibuat.push(baruId);
      const { data: lama } = await a.from("peminjaman").select("status").eq("id", pid).single();
      const { data: baru } = await a.from("peminjaman").select("status, perpanjangan_dari, keperluan, nama_peminjam").eq("id", baruId).single();
      return (
        lama!.status === "selesai" && baru!.status === "dipinjam" && baru!.perpanjangan_dari === pid &&
        baru!.keperluan.includes("Perpanjangan: Acara diperpanjang 2 hari") && baru!.nama_peminjam === DATA_PEMINJAM.p_nama_peminjam
      ) || JSON.stringify({ lama, baru });
    });

    await check("S7: unit & kondisi_keluar disalin, aset tetap 'dipinjam', tanpa pemasangan/pengembalian", async () => {
      const { data: det } = await a.from("detail_peminjaman").select("aset_id, kondisi_keluar").eq("peminjaman_id", baruId);
      const { data: as } = await a.from("aset").select("status").in("id", [lpt3, wcm2]);
      const { count: pasang } = await admin.from("pemasangan").select("*", { count: "exact", head: true }).eq("peminjaman_id", baruId);
      const { count: kembali } = await admin.from("pengembalian").select("*", { count: "exact", head: true }).eq("peminjaman_id", pid);
      return (
        det!.length === 2 && det!.every((d) => d.kondisi_keluar === "baik") &&
        as!.every((x) => x.status === "dipinjam") && pasang === 0 && kembali === 0
      ) || JSON.stringify({ det, as, pasang, kembali });
    });

    await check("Unit pada perpanjangan tetap tidak tersedia untuk dipinjam", async () => {
      const { data: k } = await a.from("kategori").select("id").eq("nama", "Laptop").single();
      const { data } = await a.rpc("aset_tersedia", { p_kategori_id: k!.id });
      return !data!.some((x) => x.kode_aset === "TI-LPT-003") || "TI-LPT-003 muncul";
    });

    await check("Peminjaman lama tidak bisa diperpanjang lagi", async () => {
      const { error } = await a.rpc("perpanjang_peminjaman", {
        p_peminjaman_id: pid, p_tgl_rencana_kembali: new Date(Date.now() + 86400_000).toISOString(), p_alasan: "x",
      });
      return !!error;
    });

    await check("Pengembalian dilakukan pada peminjaman baru → selesai, aset tersedia", async () => {
      const { data: rid } = await s.rpc("reservasi_id_kejadian", { p_jenis: "pengembalian", p_peminjaman_id: baruId });
      const foto = await unggahFoto(s, "pengembalian", rid!, 1);
      const { data: det } = await s.from("detail_peminjaman").select("id").eq("peminjaman_id", baruId);
      const { error } = await s.rpc("simpan_pengembalian", {
        p_peminjaman_id: baruId, p_pengembalian_id: rid!,
        p_units: det!.map((d) => ({ detail_id: d.id, kondisi_masuk: "baik" })), p_foto: foto,
      });
      if (error) return error.message;
      const { data: as } = await a.from("aset").select("status").in("id", [lpt3, wcm2]);
      return as!.every((x) => x.status === "tersedia") || JSON.stringify(as);
    });

    await check("Notifikasi: tandai satu & semua dibaca (hanya milik sendiri)", async () => {
      const { data: mine } = await a.from("notifikasi").select("id").eq("sudah_dibaca", false);
      if (!mine?.length) return "tidak ada notifikasi";
      await a.from("notifikasi").update({ sudah_dibaca: true }).eq("id", mine[0].id);
      const { data: other } = await s.from("notifikasi").select("id").eq("sudah_dibaca", false);
      // Admin mencoba menandai notifikasi Sarpras → tidak berpengaruh.
      await a.from("notifikasi").update({ sudah_dibaca: true }).in("id", other!.map((o) => o.id));
      const { count: sisaS } = await s.from("notifikasi").select("*", { count: "exact", head: true }).eq("sudah_dibaca", false);
      await a.rpc("baca_semua_notifikasi");
      const { count: sisaA } = await a.from("notifikasi").select("*", { count: "exact", head: true }).eq("sudah_dibaca", false);
      return (sisaS === other!.length && sisaA === 0) || `sarpras ${sisaS}/${other!.length}, admin ${sisaA}`;
    });
  } finally {
    await bersihkan(dibuat, ASET_UJI);
    await cleanupUser(adm.id);
    await cleanupUser(sar.id);
  }
  summary();
}

main().catch(async (e) => {
  console.error(e);
  await admin.from("aset").update({ status: "tersedia", kondisi: "baik" }).in("kode_aset", ASET_UJI);
  process.exit(1);
});
