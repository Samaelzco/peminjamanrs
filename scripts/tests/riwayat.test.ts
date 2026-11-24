// Uji halaman Riwayat lewat HTTP (server harus berjalan): npm run test:riwayat
import { admin, check, cleanupUser, signIn, summary, tempUser } from "./helpers";
import { asetIds, bersihkan, DATA_PEMINJAM } from "./fixtures";
import { sessionCookie } from "./session";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3123";
const get = async (path: string, cookie: string) =>
  (await fetch(BASE + path, { headers: { cookie }, redirect: "manual" })).text();

async function main() {
  console.log(`Uji Riwayat (${BASE})`);
  const adm = await tempUser("Administrasi", "radm");
  const dibuat: number[] = [];
  try {
    const a = await signIn(adm.email, adm.password);
    const cookie = await sessionCookie(adm.email, adm.password);
    const [lpt1, prj3] = await asetIds(a, ["LPT-001", "PRJ-003"]);

    // 22 peminjaman dibatalkan (LPT-001), tanggal keluar mundur per hari.
    for (let i = 0; i < 22; i++) {
      const keluar = new Date(Date.UTC(2026, 0, 1 + i, 2, 0)); // 10:00 WITA
      const { data, error } = await a.rpc("buat_peminjaman", {
        ...DATA_PEMINJAM,
        p_nama_peminjam: i === 0 ? "Budi Riwayat" : `Peminjam ${i}`,
        p_divisi_peminjam: i === 1 ? "Radiologi Uji" : "Instalasi Uji",
        p_tgl_peminjaman: keluar.toISOString(),
        p_tgl_rencana_kembali: new Date(keluar.getTime() + 3600_000).toISOString(),
        p_aset_ids: [i === 2 ? prj3 : lpt1],
      });
      if (error) throw error;
      dibuat.push(data![0].id);
      await a.rpc("batalkan_peminjaman", { p_peminjaman_id: data![0].id });
    }
    // Satu peminjaman masih diajukan.
    const { data: aktif } = await a.rpc("buat_peminjaman", {
      ...DATA_PEMINJAM, p_nama_peminjam: "Masih Diajukan",
      p_tgl_peminjaman: new Date(Date.UTC(2026, 1, 15, 2)).toISOString(),
      p_tgl_rencana_kembali: new Date(Date.UTC(2026, 1, 15, 5)).toISOString(), p_aset_ids: [lpt1],
    });
    dibuat.push(aktif![0].id);
    const { data: kodeList } = await a.from("peminjaman").select("id, kode_peminjaman").in("id", dibuat);
    const kode = (id: number) => kodeList!.find((k) => k.id === id)!.kode_peminjaman;

    await check("Halaman 1 berisi 20 baris + pagination", async () => {
      const html = await get("/riwayat", cookie);
      const rows = (html.match(/href="\/peminjaman\/\d+"/g) ?? []).length;
      return (rows === 20 && html.includes("dari 23 peminjaman") && html.includes("Berikutnya")) || `rows ${rows}`;
    });
    await check("Halaman 2 berisi 3 baris sisanya", async () => {
      const html = await get("/riwayat?halaman=2", cookie);
      const rows = (html.match(/href="\/peminjaman\/\d+"/g) ?? []).length;
      return rows === 3 || `rows ${rows}`;
    });
    await check("Cari nama peminjam", async () => {
      const html = await get("/riwayat?q=Budi", cookie);
      return (html.includes("Budi Riwayat") && html.includes("dari 1 peminjaman")) || "tidak cocok";
    });
    await check("Cari divisi", async () => {
      const html = await get("/riwayat?q=Radiologi", cookie);
      return html.includes("dari 1 peminjaman") || "tidak cocok";
    });
    await check("Cari kode peminjaman", async () => {
      const html = await get(`/riwayat?q=${kode(dibuat[5])}`, cookie);
      return (html.includes(kode(dibuat[5])) && html.includes("dari 1 peminjaman")) || "tidak cocok";
    });
    await check("Cari kode aset (PRJ-003)", async () => {
      const html = await get("/riwayat?q=PRJ-003", cookie);
      return (html.includes(kode(dibuat[2])) && html.includes("dari 1 peminjaman")) || "tidak cocok";
    });
    await check("Filter status Diajukan", async () => {
      const html = await get("/riwayat?status=diajukan", cookie);
      return (html.includes("Masih Diajukan") && html.includes("dari 1 peminjaman")) || "tidak cocok";
    });
    await check("Filter rentang tanggal (03–05 Jan 2026 WITA) → 3 baris", async () => {
      const html = await get("/riwayat?dari=2026-01-03&sampai=2026-01-05", cookie);
      return html.includes("dari 3 peminjaman") || "tidak cocok";
    });
  } finally {
    await bersihkan(dibuat, ["LPT-001", "PRJ-003"]);
    await cleanupUser(adm.id);
  }
  summary();
}

main().catch(async (e) => {
  console.error(e);
  await admin.from("aset").update({ status: "tersedia" }).in("kode_aset", ["LPT-001", "PRJ-003"]);
  process.exit(1);
});
