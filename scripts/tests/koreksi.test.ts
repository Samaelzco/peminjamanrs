// Uji status Terlambat saat dibuat & koreksi manual riwayat (ubah_peminjaman): npm run test:koreksi
import { admin, check, cleanupUser, signIn, summary, tempUser, type Db } from "./helpers";
import { bersihkan, DATA_PEMINJAM, jadwal, unggahFoto } from "./fixtures";

/** Dua aset yang sedang bebas (tidak terikat peminjaman aktif mana pun). */
async function asetBebas(n: number) {
  const { data: aktif } = await admin
    .from("detail_peminjaman")
    .select("aset_id, peminjaman!inner(status)")
    .in("peminjaman.status", ["diajukan", "dipinjam", "terlambat"]);
  const terikat = new Set((aktif ?? []).map((d) => d.aset_id));
  const { data } = await admin.from("aset").select("id, kode_aset").eq("status", "tersedia").order("id");
  const bebas = (data ?? []).filter((a) => !terikat.has(a.id)).slice(0, n);
  if (bebas.length < n) throw new Error(`Butuh ${n} aset bebas, hanya ada ${bebas.length}.`);
  return bebas;
}

const statusOf = async (id: number) =>
  (await admin.from("peminjaman").select("status").eq("id", id).single()).data!.status;
const statusAset = async (id: number) => (await admin.from("aset").select("status").eq("id", id).single()).data!.status;

function ubah(db: Db, id: number, over: Record<string, unknown>) {
  return admin
    .from("peminjaman")
    .select("*")
    .eq("id", id)
    .single()
    .then(({ data: p }) =>
      db.rpc("ubah_peminjaman", {
        p_peminjaman_id: id,
        p_nama_peminjam: p!.nama_peminjam,
        p_divisi_peminjam: p!.divisi_peminjam,
        p_kontak_peminjam: p!.kontak_peminjam,
        p_ruangan: p!.ruangan,
        p_keperluan: p!.keperluan,
        p_tgl_peminjaman: p!.tgl_peminjaman,
        p_tgl_rencana_kembali: p!.tgl_rencana_kembali,
        p_status: p!.status,
        ...over,
      }),
    );
}

async function main() {
  console.log("Uji Terlambat saat dibuat & koreksi manual");
  const adm = await tempUser("Administrasi", "kadm");
  const sar = await tempUser("Sarana dan Prasarana", "ksar");
  const dibuat: number[] = [];
  const [u1, u2] = await asetBebas(2);
  const kodeUji = [u1.kode_aset, u2.kode_aset];

  try {
    const a = await signIn(adm.email, adm.password);
    const s = await signIn(sar.email, sar.password);

    // --- 1. Rencana kembali sudah lewat → langsung Terlambat
    const { data: b1, error: e1 } = await a.rpc("buat_peminjaman", {
      ...DATA_PEMINJAM, ...jadwal(-5, 4), p_aset_ids: [u1.id],
    });
    if (e1) throw e1;
    const pLewat = b1![0].id;
    dibuat.push(pLewat);

    await check("Peminjaman dengan rencana kembali lewat langsung berstatus terlambat", async () =>
      (await statusOf(pLewat)) === "terlambat" || `status ${await statusOf(pLewat)}`);
    await check("Admin menerima notifikasi terlambat", async () => {
      const { count } = await admin.from("notifikasi").select("id", { count: "exact", head: true })
        .eq("user_id", adm.id).eq("peminjaman_id", pLewat).eq("jenis", "terlambat");
      return count === 1 || `jumlah ${count}`;
    });
    await check("Sarpras tetap menerima notifikasi pemasangan", async () => {
      const { count } = await admin.from("notifikasi").select("id", { count: "exact", head: true })
        .eq("user_id", sar.id).eq("peminjaman_id", pLewat).eq("jenis", "info");
      return count === 1 || `jumlah ${count}`;
    });
    await check("Pengembalian ditolak sebelum unit dipasang", async () => {
      const { error } = await s.rpc("reservasi_id_kejadian", { p_jenis: "pengembalian", p_peminjaman_id: pLewat });
      return !!error || "tidak ditolak";
    });
    await check("Perpanjangan ditolak sebelum unit dipasang", async () => {
      const { error } = await a.rpc("perpanjang_peminjaman", {
        p_peminjaman_id: pLewat, p_tgl_rencana_kembali: jadwal(1, 4).p_tgl_rencana_kembali, p_alasan: "uji",
      });
      return !!error || "tidak ditolak";
    });
    await check("Rencana kembali masa depan tetap berstatus diajukan", async () => {
      const { data, error } = await a.rpc("buat_peminjaman", { ...DATA_PEMINJAM, ...jadwal(0, 4), p_aset_ids: [u2.id] });
      if (error) return error.message;
      dibuat.push(data![0].id);
      return (await statusOf(data![0].id)) === "diajukan";
    });
    const pDepan = dibuat[1];

    // --- 2. Pemasangan pada peminjaman yang sudah terlambat
    await check("Pemasangan peminjaman terlambat: status tetap terlambat, unit dipinjam", async () => {
      const { data: rid, error: er } = await s.rpc("reservasi_id_kejadian", { p_jenis: "pemasangan", p_peminjaman_id: pLewat });
      if (er) return er.message;
      const foto = await unggahFoto(s, "pemasangan", rid!, 1);
      const { data: det } = await s.from("detail_peminjaman").select("id").eq("peminjaman_id", pLewat);
      const { error } = await s.rpc("simpan_pemasangan", {
        p_peminjaman_id: pLewat, p_pemasangan_id: rid!,
        p_units: det!.map((d) => ({ detail_id: d.id, kondisi_keluar: "baik" })), p_foto: foto,
      });
      if (error) return error.message;
      return ((await statusOf(pLewat)) === "terlambat" && (await statusAset(u1.id)) === "dipinjam") || "tidak sesuai";
    });

    // --- 3. Koreksi manual
    await check("Sarpras tidak bisa memakai ubah_peminjaman", async () => {
      const { error } = await ubah(s, pLewat, { p_nama_peminjam: "Diubah Sarpras" });
      return !!error || "tidak ditolak";
    });
    await check("Admin memperbaiki nama → tercatat di log", async () => {
      const { error } = await ubah(a, pLewat, { p_nama_peminjam: "Nama Diperbaiki", p_keterangan: "salah ketik" });
      if (error) return error.message;
      const { data: p } = await admin.from("peminjaman").select("nama_peminjam").eq("id", pLewat).single();
      const { data: log } = await admin.from("log_peminjaman").select("keterangan, status_lama, status_baru")
        .eq("peminjaman_id", pLewat).order("id", { ascending: false }).limit(1).single();
      return (p!.nama_peminjam === "Nama Diperbaiki" && log!.status_lama === log!.status_baru &&
        !!log!.keterangan?.includes("nama")) || JSON.stringify(log);
    });
    await check("Status dipinjam ditolak bila rencana kembali sudah lewat", async () => {
      const { error } = await ubah(a, pLewat, { p_status: "dipinjam" });
      return !!error || "tidak ditolak";
    });
    await check("Rencana kembali dimundurkan + status dipinjam → berhasil", async () => {
      const { error } = await ubah(a, pLewat, { p_status: "dipinjam", p_tgl_rencana_kembali: jadwal(2, 1).p_tgl_rencana_kembali });
      return error ? error.message : (await statusOf(pLewat)) === "dipinjam";
    });
    await check("Unit sudah dipasang: status diajukan ditolak", async () => {
      const { error } = await ubah(a, pLewat, { p_status: "diajukan" });
      return !!error || "tidak ditolak";
    });
    await check("Status selesai manual → unit kembali tersedia", async () => {
      const { error } = await ubah(a, pLewat, { p_status: "selesai" });
      if (error) return error.message;
      return ((await statusOf(pLewat)) === "selesai" && (await statusAset(u1.id)) === "tersedia") || "tidak sesuai";
    });
    await check("Diaktifkan kembali (dipinjam) → unit dipinjam lagi", async () => {
      const { error } = await ubah(a, pLewat, { p_status: "dipinjam" });
      if (error) return error.message;
      return ((await statusOf(pLewat)) === "dipinjam" && (await statusAset(u1.id)) === "dipinjam") || "tidak sesuai";
    });
    await check("Belum dipasang: dibatalkan lalu diaktifkan kembali (diajukan)", async () => {
      const r1 = await ubah(a, pDepan, { p_status: "dibatalkan" });
      if (r1.error) return r1.error.message;
      const r2 = await ubah(a, pDepan, { p_status: "diajukan" });
      if (r2.error) return r2.error.message;
      return (await statusOf(pDepan)) === "diajukan";
    });
    await check("Terlambat yang belum dipasang bisa dibatalkan", async () => {
      const r = await ubah(a, pDepan, {
        p_status: "terlambat",
        p_tgl_peminjaman: jadwal(-5).p_tgl_peminjaman,
        p_tgl_rencana_kembali: jadwal(-1).p_tgl_peminjaman,
      });
      if (r.error) return r.error.message;
      const { error } = await a.rpc("batalkan_peminjaman", { p_peminjaman_id: pDepan, p_alasan: "uji" });
      return error ? error.message : (await statusOf(pDepan)) === "dibatalkan";
    });

    // --- 4. Setelah pengembalian, status dikunci
    await check("Setelah pengembalian, status tidak bisa diubah", async () => {
      const { data: rid } = await s.rpc("reservasi_id_kejadian", { p_jenis: "pengembalian", p_peminjaman_id: pLewat });
      const foto = await unggahFoto(s, "pengembalian", rid!, 1);
      const { data: det } = await s.from("detail_peminjaman").select("id").eq("peminjaman_id", pLewat);
      const { error: ek } = await s.rpc("simpan_pengembalian", {
        p_peminjaman_id: pLewat, p_pengembalian_id: rid!,
        p_units: det!.map((d) => ({ detail_id: d.id, kondisi_masuk: "baik", catatan: "" })), p_foto: foto,
      });
      if (ek) return ek.message;
      const { error } = await ubah(a, pLewat, { p_status: "dipinjam" });
      return !!error || "tidak ditolak";
    });
  } finally {
    await bersihkan(dibuat, kodeUji);
    await cleanupUser(adm.id);
    await cleanupUser(sar.id);
  }
  summary();
}

main();
