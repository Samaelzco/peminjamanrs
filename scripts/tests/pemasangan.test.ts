// Uji pemasangan, ganti unit, pengembalian (skenario 5, 8, 9): npm run test:pemasangan
import { admin, check, cleanupUser, signIn, summary, tempUser } from "./helpers";
import { asetIds, bersihkan, DATA_PEMINJAM, jadwal, unggahFoto } from "./fixtures";

const ASET_UJI = ["LPT-001", "LPT-002", "LPT-003", "PRJ-001", "PRJ-002", "WCM-001"];

async function main() {
  console.log("Uji pemasangan & pengembalian (database + storage)");
  const adm = await tempUser("Administrasi", "sadm");
  const sar = await tempUser("Sarana dan Prasarana", "ssar");
  const dibuat: number[] = [];

  try {
    const a = await signIn(adm.email, adm.password);
    const s = await signIn(sar.email, sar.password);
    const [lpt1, lpt2, lpt3, prj1, , wcm1] = await asetIds(a, ASET_UJI);

    // Peminjaman: LPT-001, PRJ-001, WCM-001
    const { data: buat, error: e0 } = await a.rpc("buat_peminjaman", {
      ...DATA_PEMINJAM, ...jadwal(), p_aset_ids: [lpt1, prj1, wcm1],
    });
    if (e0) throw e0;
    const pid = buat![0].id;
    dibuat.push(pid);
    const { data: detail } = await s.from("detail_peminjaman").select("id, aset_id").eq("peminjaman_id", pid);
    const dLpt = detail!.find((d) => d.aset_id === lpt1)!;

    await check("Admin tidak bisa memesan ID pemasangan (tanpa pemasangan.create)", async () => {
      const { error } = await a.rpc("reservasi_id_kejadian", { p_jenis: "pemasangan", p_peminjaman_id: pid });
      return !!error;
    });

    await check("Admin tidak bisa mengunggah foto pemasangan", async () => {
      try {
        await unggahFoto(a, "pemasangan", 999999, 1);
        return "upload berhasil";
      } catch {
        return true;
      }
    });

    await check("Ganti unit: LPT-001 gagal dites → diganti LPT-002, LPT-001 jadi dalam_perbaikan", async () => {
      const { error } = await s.rpc("ganti_unit_pemasangan", {
        p_detail_id: dLpt.id, p_aset_baru_id: lpt2, p_alasan: "Tidak menyala saat dites",
      });
      if (error) return error.message;
      const { data: d } = await s.from("detail_peminjaman").select("aset_id").eq("id", dLpt.id).single();
      const { data: lama } = await s.from("aset").select("status").eq("id", lpt1).single();
      const { data: log } = await s.from("penggantian_unit").select("alasan").eq("detail_peminjaman_id", dLpt.id);
      return (d!.aset_id === lpt2 && lama!.status === "dalam_perbaikan" && log!.length === 1) || "tidak sesuai";
    });

    await check("Ganti unit tanpa alasan ditolak", async () => {
      const { error } = await s.rpc("ganti_unit_pemasangan", { p_detail_id: dLpt.id, p_aset_baru_id: lpt3, p_alasan: " " });
      return !!error?.message.includes("Alasan");
    });

    await check("Ganti ke unit kategori lain ditolak", async () => {
      const { data: prj2 } = await s.from("aset").select("id").eq("kode_aset", "PRJ-002").single();
      const { error } = await s.rpc("ganti_unit_pemasangan", { p_detail_id: dLpt.id, p_aset_baru_id: prj2!.id, p_alasan: "x" });
      return !!error?.message.includes("kategori");
    });

    let pemasanganId = 0;
    await check("Pemasangan tanpa foto ditolak", async () => {
      const { data: rid } = await s.rpc("reservasi_id_kejadian", { p_jenis: "pemasangan", p_peminjaman_id: pid });
      pemasanganId = rid!;
      const units = detail!.map((d) => ({ detail_id: d.id, kondisi_keluar: "baik" }));
      const { error } = await s.rpc("simpan_pemasangan", {
        p_peminjaman_id: pid, p_pemasangan_id: pemasanganId, p_units: units, p_foto: [],
      });
      return !!error?.message.includes("minimal 1 foto");
    });

    await check("Pemasangan dengan path foto yang tidak ada ditolak", async () => {
      const units = detail!.map((d) => ({ detail_id: d.id, kondisi_keluar: "baik" }));
      const { error } = await s.rpc("simpan_pemasangan", {
        p_peminjaman_id: pid, p_pemasangan_id: pemasanganId, p_units: units,
        p_foto: [`pemasangan/${pemasanganId}/00000000-0000-0000-0000-000000000000.jpg`],
      });
      return !!error?.message.includes("belum terunggah");
    });

    await check("S5: pemasangan dengan 2 foto → peminjaman & aset 'dipinjam'", async () => {
      const foto = await unggahFoto(s, "pemasangan", pemasanganId, 2);
      const units = detail!.map((d) => ({ detail_id: d.id, kondisi_keluar: "baik" }));
      const { error } = await s.rpc("simpan_pemasangan", {
        p_peminjaman_id: pid, p_pemasangan_id: pemasanganId, p_units: units, p_foto: foto,
      });
      if (error) return error.message;
      const { data: p } = await s.from("peminjaman").select("status").eq("id", pid).single();
      const { data: as } = await s.from("aset").select("kode_aset, status").in("id", [lpt2, prj1, wcm1]);
      const { data: f } = await s.from("foto_pemasangan").select("id").eq("pemasangan_id", pemasanganId);
      return (p!.status === "dipinjam" && as!.every((x) => x.status === "dipinjam") && f!.length === 2) ||
        JSON.stringify({ p, as, f: f?.length });
    });

    await check("Foto pemasangan bisa dibuka dengan signed URL (privat)", async () => {
      const { data: f } = await s.from("foto_pemasangan").select("path_foto").eq("pemasangan_id", pemasanganId);
      const { data, error } = await a.storage.from("foto-peminjaman").createSignedUrls(f!.map((x) => x.path_foto), 60);
      if (error) return error.message;
      const res = await fetch(data![0].signedUrl!);
      const { data: pub } = a.storage.from("foto-peminjaman").getPublicUrl(f![0].path_foto);
      const resPub = await fetch(pub.publicUrl);
      return (res.ok && !resPub.ok) || `signed ${res.status}, publik ${resPub.status}`;
    });

    await check("Pemasangan kedua ditolak (sudah dipinjam)", async () => {
      const { error } = await s.rpc("reservasi_id_kejadian", { p_jenis: "pemasangan", p_peminjaman_id: pid });
      return !!error;
    });

    await check("Pengembalian: catatan wajib untuk rusak/hilang", async () => {
      const { data: rid } = await s.rpc("reservasi_id_kejadian", { p_jenis: "pengembalian", p_peminjaman_id: pid });
      const foto = await unggahFoto(s, "pengembalian", rid!, 1);
      const { data: d2 } = await s.from("detail_peminjaman").select("id").eq("peminjaman_id", pid);
      const units = d2!.map((d) => ({ detail_id: d.id, kondisi_masuk: "rusak", catatan: "" }));
      const { error } = await s.rpc("simpan_pengembalian", {
        p_peminjaman_id: pid, p_pengembalian_id: rid!, p_units: units, p_foto: foto,
      });
      await s.storage.from("foto-peminjaman").remove(foto);
      return !!error?.message.includes("Catatan wajib");
    });

    await check("Pengembalian sebagian unit ditolak (harus sekaligus)", async () => {
      const { data: rid } = await s.rpc("reservasi_id_kejadian", { p_jenis: "pengembalian", p_peminjaman_id: pid });
      const foto = await unggahFoto(s, "pengembalian", rid!, 1);
      const { data: d2 } = await s.from("detail_peminjaman").select("id").eq("peminjaman_id", pid).limit(1);
      const { error } = await s.rpc("simpan_pengembalian", {
        p_peminjaman_id: pid, p_pengembalian_id: rid!, p_units: [{ detail_id: d2![0].id, kondisi_masuk: "baik" }], p_foto: foto,
      });
      await s.storage.from("foto-peminjaman").remove(foto);
      return !!error?.message.includes("sekaligus");
    });

    await check("S8: kembali 1 baik, 1 rusak, 1 hilang → selesai; aset tersedia/dalam_perbaikan/hilang", async () => {
      const { data: rid } = await s.rpc("reservasi_id_kejadian", { p_jenis: "pengembalian", p_peminjaman_id: pid });
      const foto = await unggahFoto(s, "pengembalian", rid!, 1);
      const { data: d2 } = await s.from("detail_peminjaman").select("id, aset_id").eq("peminjaman_id", pid);
      const kondisi: Record<number, string> = { [lpt2]: "baik", [prj1]: "rusak", [wcm1]: "hilang" };
      const units = d2!.map((d) => ({
        detail_id: d.id, kondisi_masuk: kondisi[d.aset_id],
        catatan: kondisi[d.aset_id] === "baik" ? "" : `Uji ${kondisi[d.aset_id]}`,
      }));
      const { error } = await s.rpc("simpan_pengembalian", {
        p_peminjaman_id: pid, p_pengembalian_id: rid!, p_units: units, p_foto: foto,
      });
      if (error) return error.message;
      const { data: p } = await s.from("peminjaman").select("status").eq("id", pid).single();
      const { data: as } = await s.from("aset").select("id, status").in("id", [lpt2, prj1, wcm1]);
      const st = (id: number) => as!.find((x) => x.id === id)!.status;
      return (p!.status === "selesai" && st(lpt2) === "tersedia" && st(prj1) === "dalam_perbaikan" && st(wcm1) === "hilang") ||
        JSON.stringify({ p, as });
    });

    await check("S8: notifikasi unit rusak/hilang ke user peminjaman.view", async () => {
      const { data } = await a.from("notifikasi").select("pesan").eq("peminjaman_id", pid).like("pesan", "Pengembalian%");
      return (data?.length === 1 && data[0].pesan.includes("PRJ-001 rusak") && data[0].pesan.includes("WCM-001 hilang")) ||
        JSON.stringify(data);
    });

    await check("S9: aset yang kembali tersedia (LPT-002) bisa dipinjam lagi; riwayat lama tetap ada", async () => {
      const { data, error } = await a.rpc("buat_peminjaman", { ...DATA_PEMINJAM, ...jadwal(), p_aset_ids: [lpt2] });
      if (error) return error.message;
      dibuat.push(data![0].id);
      const { data: riwayat } = await a.from("detail_peminjaman").select("peminjaman_id").eq("aset_id", lpt2);
      return (riwayat!.length === 2 && riwayat!.some((r) => r.peminjaman_id === pid)) || JSON.stringify(riwayat);
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
