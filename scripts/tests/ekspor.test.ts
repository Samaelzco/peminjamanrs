// Uji ekspor rekap Excel lewat HTTP. Jalankan server dulu (npm run build && npx next start -p 3123),
// lalu: npm run test:ekspor
import ExcelJS from "exceljs";
import { admin, check, cleanupUser, signIn, summary, tempUser } from "./helpers";
import { bersihkan, DATA_PEMINJAM, jadwal, unggahFoto } from "./fixtures";
import { sessionCookie } from "./session";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3123";

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

const hariIni = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

async function main() {
  console.log(`Uji ekspor rekap (${BASE})`);
  const adm = await tempUser("Administrasi", "eadm");
  const sar = await tempUser("Sarana dan Prasarana", "esar");
  const dibuat: number[] = [];
  const [u1, u2] = await asetBebas(2);
  try {
    const a = await signIn(adm.email, adm.password);
    const s = await signIn(sar.email, sar.password);
    const nama = `Uji Ekspor ${Date.now()}`;

    // 1) Terlambat sejak dicatat lalu dipasang & dikembalikan (terlambat ±1 jam).
    const { data: b1, error: e1 } = await a.rpc("buat_peminjaman", {
      ...DATA_PEMINJAM, p_nama_peminjam: nama, ...jadwal(-3, 2), p_aset_ids: [u1.id],
    });
    if (e1) throw e1;
    const p1 = b1![0];
    dibuat.push(p1.id);
    const { data: rid } = await s.rpc("reservasi_id_kejadian", { p_jenis: "pemasangan", p_peminjaman_id: p1.id });
    const { data: det } = await s.from("detail_peminjaman").select("id").eq("peminjaman_id", p1.id);
    let r = await s.rpc("simpan_pemasangan", {
      p_peminjaman_id: p1.id, p_pemasangan_id: rid!,
      p_units: det!.map((d) => ({ detail_id: d.id, kondisi_keluar: "baik" })), p_foto: await unggahFoto(s, "pemasangan", rid!, 1),
    });
    if (r.error) throw r.error;
    const { data: rk } = await s.rpc("reservasi_id_kejadian", { p_jenis: "pengembalian", p_peminjaman_id: p1.id });
    r = await s.rpc("simpan_pengembalian", {
      p_peminjaman_id: p1.id, p_pengembalian_id: rk!,
      p_units: det!.map((d) => ({ detail_id: d.id, kondisi_masuk: "rusak", catatan: "Layar retak" })),
      p_foto: await unggahFoto(s, "pengembalian", rk!, 1),
    });
    if (r.error) throw r.error;

    // 2) Tepat waktu, masih diajukan.
    const { data: b2, error: e2 } = await a.rpc("buat_peminjaman", {
      ...DATA_PEMINJAM, p_nama_peminjam: nama, ...jadwal(0, 4), p_aset_ids: [u2.id],
    });
    if (e2) throw e2;
    const p2 = b2![0];
    dibuat.push(p2.id);

    const ca = await sessionCookie(adm.email, adm.password);
    const cs = await sessionCookie(sar.email, sar.password);
    const url = `/riwayat/ekspor?q=${encodeURIComponent(nama)}&dari=${hariIni()}&sampai=${hariIni()}`;

    await check("Tanpa login: ekspor dialihkan ke /login", async () => {
      const res = await fetch(BASE + url, { redirect: "manual" });
      return res.status === 307 || `status ${res.status}`;
    });

    const res = await fetch(BASE + url, { headers: { cookie: ca } });
    const buf = Buffer.from(await res.arrayBuffer());
    const wb = new ExcelJS.Workbook();

    await check("Admin mengunduh file .xlsx", async () => {
      const ok = res.status === 200 &&
        res.headers.get("content-type")?.includes("spreadsheetml") &&
        res.headers.get("content-disposition")?.includes(".xlsx");
      if (!ok) return `status ${res.status} ${res.headers.get("content-type")}`;
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
      return true;
    });
    await check("Berisi sheet Ringkasan, Riwayat, Keterlambatan, Per Unit", async () => {
      const names = wb.worksheets.map((w) => w.name).join(",");
      return names === "Ringkasan,Riwayat,Keterlambatan,Per Unit" || names;
    });
    await check("Riwayat memuat 2 peminjaman sesuai filter", async () => {
      const ws = wb.getWorksheet("Riwayat")!;
      const kode = ws.getColumn(1).values.slice(2).map(String);
      return (kode.length === 2 && kode.includes(p1.kode_peminjaman) && kode.includes(p2.kode_peminjaman)) || kode.join(",");
    });
    await check("Keterlambatan hanya memuat peminjaman yang terlambat, dengan durasi", async () => {
      const ws = wb.getWorksheet("Keterlambatan")!;
      const kode = ws.getColumn(1).values.slice(2).map(String);
      const jam = Number(ws.getRow(2).getCell(12).value);
      return (kode.length === 1 && kode[0] === p1.kode_peminjaman && jam >= 0.9 && jam <= 1.2) || `${kode} ${jam}`;
    });
    await check("Ringkasan: total 2, pernah terlambat 1", async () => {
      const ws = wb.getWorksheet("Ringkasan")!;
      const nilai = new Map<string, unknown>();
      ws.eachRow((row) => nilai.set(String(row.getCell(1).value), row.getCell(2).value));
      return (nilai.get("Total peminjaman") === 2 && nilai.get("Peminjaman pernah terlambat") === 1) ||
        `${nilai.get("Total peminjaman")}/${nilai.get("Peminjaman pernah terlambat")}`;
    });
    await check("Per Unit: unit yang kembali rusak tercatat", async () => {
      const ws = wb.getWorksheet("Per Unit")!;
      let rusak = -1;
      ws.eachRow((row) => { if (row.getCell(1).value === u1.kode_aset) rusak = Number(row.getCell(6).value); });
      return rusak === 1 || `rusak ${rusak}`;
    });
    await check("Waktu ditulis dalam WITA", async () => {
      const ws = wb.getWorksheet("Riwayat")!;
      const row = [...Array(ws.rowCount).keys()].map((i) => ws.getRow(i + 1)).find((x) => x.getCell(1).value === p2.kode_peminjaman)!;
      const keluar = row.getCell(9).value as Date;
      const { data: p } = await admin.from("peminjaman").select("tgl_peminjaman").eq("id", p2.id).single();
      const selisihJam = (keluar.getTime() - new Date(p!.tgl_peminjaman).getTime()) / 3600_000;
      return Math.abs(selisihJam - 8) < 0.01 || `selisih ${selisihJam}`;
    });
    await check("Sarpras (riwayat.view) juga bisa mengunduh", async () => {
      const rs = await fetch(BASE + url, { headers: { cookie: cs } });
      return rs.status === 200 || `status ${rs.status}`;
    });
  } finally {
    await bersihkan(dibuat, [u1.kode_aset, u2.kode_aset]);
    await cleanupUser(adm.id);
    await cleanupUser(sar.id);
  }
  summary();
}

main();
