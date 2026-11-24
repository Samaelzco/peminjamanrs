/**
 * Pengujian 5 transaksi fiktif lewat UI (Admin & Sarpras) + verifikasi database.
 * Jalankan: npm run build && npx playwright test
 * Prasyarat: kondisi awal sesuai prompt (8 aset tersedia/baik, belum ada peminjaman).
 */
import fs from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  AKUN, apiSebagai, assert, cek, db, DIR_SCREENSHOT, HARI, JAM, pemetaan, siapkanFotoDummy,
  simpanHasil, sqlLog, witaInput,
} from "./support";

test.describe.configure({ mode: "serial" });

const PEMINJAM = {
  "TRX-004": { nama: "Ibu Sari Wulandari", divisi: "Bagian Humas", kontak: "0812-0000-0004", ruangan: "R. Humas", keperluan: "Rekaman video edukasi pasien" },
  "TRX-001": { nama: "dr. Ayu Pratiwi", divisi: "Instalasi Radiologi", kontak: "0812-0000-0001", ruangan: "R. Rapat Radiologi Lt. 2", keperluan: "Presentasi kasus mingguan" },
  "TRX-002": { nama: "Ns. Komang Ariani", divisi: "Bidang Diklat", kontak: "0812-0000-0002", ruangan: "Aula Diklat", keperluan: "Pelatihan BHD perawat secara hybrid" },
  "TRX-005": { nama: "dr. Made Suardana", divisi: "Poli Anak", kontak: "0812-0000-0005", ruangan: "R. Seminar Poli Anak", keperluan: "Webinar penyuluhan orang tua pasien" },
} as const;
type Label = keyof typeof PEMINJAM;

let adminCtx: BrowserContext;
let sarprasCtx: BrowserContext;
let admin: Page;
let sarpras: Page;
let foto: string[] = [];

// ---------------------------------------------------------------------
// Helper UI
// ---------------------------------------------------------------------
async function login(page: Page, akun: { email: string; password: string }) {
  await page.goto("/login");
  await page.locator("#email").fill(akun.email);
  await page.locator("#password").fill(akun.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

async function shot(page: Page, nama: string) {
  await page.screenshot({ path: path.join(DIR_SCREENSHOT, `${nama}.png`), fullPage: true }).catch(() => {});
}

async function bukaFormBaru(page: Page, label: Label, keluar = witaInput(0), kembali = witaInput(8 * JAM)) {
  const d = PEMINJAM[label];
  await page.goto("/peminjaman/baru");
  await page.locator("#nama_peminjam").fill(d.nama);
  await page.locator("#kontak_peminjam").fill(d.kontak);
  await page.locator("#divisi_peminjam").fill(d.divisi);
  await page.locator("#ruangan").fill(d.ruangan);
  await page.locator("#keperluan").fill(d.keperluan);
  await page.locator("#tgl_peminjaman").fill(keluar);
  await page.locator("#tgl_rencana_kembali").fill(kembali);
}

async function kodeDraft(page: Page) {
  const cells = await page.locator("table tbody tr td:first-child").allTextContents();
  return cells.map((c) => c.trim()).filter((c) => /^[A-Z]{2,5}-\d{3,}$/.test(c));
}

/** Klik + Tambah Unit; kembalikan pesan error (kalau ada) dan kode di tabel. */
async function tambahUnit(page: Page, kategori: string, jumlah: number) {
  const sebelum = (await kodeDraft(page)).length;
  await page.locator("#kategori").selectOption({ label: kategori });
  await page.locator("#jumlah").fill(String(jumlah));
  await page.getByRole("button", { name: "Tambah Unit" }).click();
  const alert = page.getByRole("alert").filter({ hasText: /tersedia|Pilih|minimal/i });
  const tombol = page.getByRole("button", { name: "Tambah Unit" });
  await expect
    .poll(
      async () =>
        (await tombol.isEnabled()) &&
        ((await kodeDraft(page)).length !== sebelum || (await alert.count()) > 0),
      { timeout: 15_000 },
    )
    .toBe(true);
  const error = (await alert.count()) > 0 ? (await alert.first().innerText()).trim() : null;
  return { error, kode: await kodeDraft(page) };
}

async function simpanPeminjaman(page: Page, label: string) {
  await page.getByRole("button", { name: "Simpan Peminjaman" }).click();
  await page.waitForURL(/\/peminjaman\/\d+\?baru=1/);
  const id = Number(new URL(page.url()).pathname.split("/")[2]);
  const kode = (await page.locator("h1").first().innerText()).trim();
  pemetaan[label] = { id, kode };
  return { id, kode };
}

async function pilihFoto(page: Page, files: string[]) {
  await page.locator('input[type="file"][multiple]').setInputFiles(files);
  await expect(page.getByAltText("Pratinjau foto")).toHaveCount(files.length, { timeout: 30_000 });
}

async function pemasangan(page: Page, id: number, jumlahFoto: number) {
  await page.goto(`/peminjaman/${id}/pemasangan`);
  for (const r of await page.locator('input[type="radio"][value="baik"]').all()) await r.check();
  await pilihFoto(page, foto.slice(0, jumlahFoto));
  await page.getByRole("button", { name: "Simpan Pemasangan" }).click();
  await page.waitForURL(new RegExp(`/peminjaman/${id}$`), { timeout: 60_000 });
}

async function isiPengembalian(page: Page, kondisi: Record<string, { k: "baik" | "rusak" | "hilang"; catatan?: string }>) {
  for (const [kode, v] of Object.entries(kondisi)) {
    const li = page.locator("li").filter({ hasText: kode }).filter({ has: page.locator('input[type="radio"]') });
    await li.locator(`input[type="radio"][value="${v.k}"]`).check();
    await page.getByLabel(`Catatan ${kode}`).fill(v.catatan ?? "");
  }
}

async function simpanPengembalian(page: Page, id: number) {
  await page.getByRole("button", { name: "Simpan Pengembalian" }).click();
  await page.waitForURL(new RegExp(`/peminjaman/${id}$`), { timeout: 60_000 });
}

/** Tunggu sampai halaman menampilkan "Akses ditolak" (konten di-stream). */
async function tertolak(page: Page) {
  return page
    .getByRole("heading", { name: "Akses ditolak" })
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
}

async function kartuDashboard(page: Page, label: string) {
  const p = page.locator("p.text-sm.text-gray-500", { hasText: new RegExp(`^${label}$`) }).first();
  return Number((await p.locator("xpath=following-sibling::p").innerText()).trim());
}

// ---------------------------------------------------------------------
// Helper database
// ---------------------------------------------------------------------
async function statusPeminjaman(id: number) {
  const { data } = await db.from("peminjaman").select("status").eq("id", id).single();
  return data!.status;
}
async function asetMap() {
  const { data } = await db.from("aset").select("id, kode_aset, status, kondisi").order("kode_aset");
  return Object.fromEntries(data!.map((a) => [a.kode_aset, a]));
}
async function staffId(email: string) {
  const { data } = await db.from("staff_it").select("id").eq("email", email).single();
  return data!.id;
}

// ---------------------------------------------------------------------
test.beforeAll(async ({ browser }) => {
  fs.mkdirSync(DIR_SCREENSHOT, { recursive: true });
  foto = await siapkanFotoDummy(browser, 5);
  adminCtx = await browser.newContext();
  sarprasCtx = await browser.newContext();
  admin = await adminCtx.newPage();
  sarpras = await sarprasCtx.newPage();
  await login(admin, AKUN.admin);
  await login(sarpras, AKUN.sarpras);
});

test.afterAll(async () => {
  simpanHasil();
  await adminCtx?.close();
  await sarprasCtx?.close();
});

test("0. Kondisi awal", async () => {
  await cek(null, "0", "8 aset tersedia/baik, belum ada peminjaman", async () => {
    const { count } = await db.from("peminjaman").select("*", { count: "exact", head: true });
    const a = await asetMap();
    assert(count === 0, `ada ${count} peminjaman`);
    assert(Object.values(a).length === 8 && Object.values(a).every((x) => x.status === "tersedia" && x.kondisi === "baik"), "aset tidak semua tersedia/baik");
    return "Sesuai: 0 peminjaman, 8 aset tersedia/baik";
  });
});

test("Langkah 1 – TRX-004: ganti unit, kembali rusak & hilang", async () => {
  await bukaFormBaru(admin, "TRX-004");

  await cek(admin, "1.1", "Laptop 1 + Webcam 1 → LPT-001 dan WCM-001", async () => {
    await tambahUnit(admin, "Laptop", 1);
    const r = await tambahUnit(admin, "Webcam", 1);
    assert(!r.error, r.error ?? "");
    assert(JSON.stringify(r.kode) === '["LPT-001","WCM-001"]', `dipilih ${r.kode.join(", ")}`);
    await shot(admin, "1.1-unit-otomatis");
    return `Dipilih ${r.kode.join(", ")}`;
  });

  await cek(admin, "1.2", "Ganti LPT-001: dropdown hanya LPT-002, LPT-003; pilih LPT-002", async () => {
    await admin.locator("table tbody tr", { hasText: "LPT-001" }).getByRole("button", { name: "Ganti" }).click();
    const select = admin.getByLabel("Ganti LPT-001");
    await expect(select).toBeVisible();
    await expect(select.locator("option")).not.toHaveCount(1);
    const opsi = (await select.locator("option").allTextContents()).filter((o) => !o.startsWith("Pilih"));
    const kodeOpsi = opsi.map((o) => o.split(" ")[0]);
    await shot(admin, "1.2-dropdown-ganti");
    assert(JSON.stringify(kodeOpsi) === '["LPT-002","LPT-003"]', `opsi: ${kodeOpsi.join(", ")}`);
    const value = await select.locator("option", { hasText: "LPT-002" }).getAttribute("value");
    await select.selectOption(value!);
    await admin.getByRole("button", { name: "Ganti Unit" }).click();
    await expect(select).toBeHidden();
    const kode = await kodeDraft(admin);
    assert(JSON.stringify(kode) === '["LPT-002","WCM-001"]', `tabel: ${kode.join(", ")}`);
    return `Opsi ${kodeOpsi.join(", ")}; tabel sekarang ${kode.join(", ")}`;
  });

  await cek(admin, "1.3", "Simpan → diajukan; LPT-002 & WCM-001 tetap tersedia tapi terkunci; Sarpras dapat notifikasi", async () => {
    const { id, kode } = await simpanPeminjaman(admin, "TRX-004");
    const st = await statusPeminjaman(id);
    const a = await asetMap();
    const api = await apiSebagai(AKUN.admin.email, AKUN.admin.password);
    const { data: lpt } = await db.from("kategori").select("id").eq("kode_prefix", "LPT").single();
    const { data: wcm } = await db.from("kategori").select("id").eq("kode_prefix", "WCM").single();
    const tl = (await api.rpc("aset_tersedia", { p_kategori_id: lpt!.id })).data!.map((x) => x.kode_aset);
    const tw = (await api.rpc("aset_tersedia", { p_kategori_id: wcm!.id })).data!.map((x) => x.kode_aset);
    const sid = await staffId(AKUN.sarpras.email);
    const { data: notif } = await db.from("notifikasi").select("pesan").eq("peminjaman_id", id).eq("user_id", sid);
    await sarpras.goto("/");
    const bell = await sarpras.getByRole("button", { name: /Notifikasi, \d+ belum dibaca/ }).getAttribute("aria-label");
    await shot(sarpras, "1.3-notifikasi-sarpras");
    assert(st === "diajukan", `status ${st}`);
    assert(a["LPT-002"].status === "tersedia" && a["WCM-001"].status === "tersedia", "status aset berubah");
    assert(!tl.includes("LPT-002") && !tw.includes("WCM-001"), `masih bisa dipilih: ${tl}, ${tw}`);
    assert(notif?.length === 1, `notifikasi sarpras: ${notif?.length}`);
    return `${kode} diajukan; aset tersedia tapi tidak muncul di pilihan (sisa laptop: ${tl.join(", ")}; webcam: ${tw.join(", ")}); notifikasi Sarpras: "${notif![0].pesan}" (${bell})`;
  });

  const id = pemetaan["TRX-004"]?.id;
  test.skip(!id, "TRX-004 gagal dibuat");

  await cek(sarpras, "1.4", "Pemasangan 2 foto → dipinjam; LPT-002 & WCM-001 dipinjam; 1 pemasangan + 2 foto", async () => {
    await pemasangan(sarpras, id, 2);
    await shot(sarpras, "1.4-detail-setelah-pemasangan");
    const st = await statusPeminjaman(id);
    const a = await asetMap();
    const { data: ps } = await db.from("pemasangan").select("id, foto_pemasangan(id)").eq("peminjaman_id", id);
    assert(st === "dipinjam", `status ${st}`);
    assert(a["LPT-002"].status === "dipinjam" && a["WCM-001"].status === "dipinjam", "aset belum dipinjam");
    assert(ps?.length === 1 && ps[0].foto_pemasangan.length === 2, `pemasangan ${ps?.length}, foto ${ps?.[0]?.foto_pemasangan.length}`);
    return "Status dipinjam; LPT-002 & WCM-001 dipinjam; 1 pemasangan, 2 foto";
  });

  await cek(sarpras, "1.6", "Pengembalian Rusak tanpa catatan → ditolak (catatan wajib)", async () => {
    await sarpras.goto(`/peminjaman/${id}/pengembalian`);
    await isiPengembalian(sarpras, { "LPT-002": { k: "rusak", catatan: "" }, "WCM-001": { k: "hilang", catatan: "Tidak ditemukan di ruangan" } });
    await pilihFoto(sarpras, foto.slice(0, 3));
    await sarpras.getByRole("button", { name: "Simpan Pengembalian" }).click();
    const msg = sarpras.getByRole("alert").filter({ hasText: /catatan/i });
    await expect(msg).toBeVisible();
    const teks = (await msg.innerText()).trim();
    await shot(sarpras, "1.6-catatan-wajib");
    // Lapis server/database juga menolak (panggilan RPC langsung).
    const api = await apiSebagai(AKUN.sarpras.email, AKUN.sarpras.password);
    const { data: rid } = await api.rpc("reservasi_id_kejadian", { p_jenis: "pengembalian", p_peminjaman_id: id });
    const { data: det } = await db.from("detail_peminjaman").select("id").eq("peminjaman_id", id);
    const { error } = await api.rpc("simpan_pengembalian", {
      p_peminjaman_id: id, p_pengembalian_id: rid!,
      p_units: det!.map((d) => ({ detail_id: d.id, kondisi_masuk: "rusak", catatan: "" })),
      p_foto: [`pengembalian/${rid}/00000000-0000-0000-0000-000000000000.jpg`],
    });
    const { count } = await db.from("pengembalian").select("*", { count: "exact", head: true }).eq("peminjaman_id", id);
    assert(count === 0, "pengembalian tersimpan");
    assert(error?.message.includes("Catatan wajib"), `RPC: ${error?.message}`);
    return `UI: "${teks}". RPC langsung: "${error!.message}". Tidak ada pengembalian tersimpan.`;
  });

  await cek(sarpras, "1.5", "Pengembalian LPT-002 Rusak, WCM-001 Hilang, 3 foto → selesai; LPT-002 dalam_perbaikan/rusak; WCM-001 hilang; notifikasi Admin", async () => {
    await sarpras.getByLabel("Catatan LPT-002").fill("Engsel layar longgar");
    await simpanPengembalian(sarpras, id);
    await shot(sarpras, "1.5-detail-setelah-pengembalian");
    const st = await statusPeminjaman(id);
    const a = await asetMap();
    const aid = await staffId(AKUN.admin.email);
    const { data: n } = await db.from("notifikasi").select("pesan").eq("peminjaman_id", id).eq("user_id", aid);
    const { data: pk } = await db.from("pengembalian").select("id, foto_pengembalian(id)").eq("peminjaman_id", id);
    assert(st === "selesai", `status ${st}`);
    assert(a["LPT-002"].status === "dalam_perbaikan" && a["LPT-002"].kondisi === "rusak", `LPT-002 ${a["LPT-002"].status}/${a["LPT-002"].kondisi}`);
    assert(a["WCM-001"].status === "hilang", `WCM-001 ${a["WCM-001"].status}`);
    assert(pk?.[0]?.foto_pengembalian.length === 3, `foto ${pk?.[0]?.foto_pengembalian.length}`);
    assert(n?.some((x) => x.pesan.includes("LPT-002 rusak") && x.pesan.includes("WCM-001 hilang")), `notif admin: ${JSON.stringify(n)}`);
    return `Selesai; LPT-002 dalam_perbaikan/rusak; WCM-001 hilang; 3 foto; notifikasi Admin: "${n!.find((x) => x.pesan.startsWith("Pengembalian"))!.pesan}"`;
  });
});

test("Langkah 2 – TRX-001: peminjaman normal", async () => {
  await bukaFormBaru(admin, "TRX-001");
  await cek(admin, "2.1", "Laptop 1 + Proyektor 1 → LPT-001 dan PRJ-001", async () => {
    await tambahUnit(admin, "Laptop", 1);
    const r = await tambahUnit(admin, "Proyektor", 1);
    assert(JSON.stringify(r.kode) === '["LPT-001","PRJ-001"]', `dipilih ${r.kode.join(", ")}`);
    return `Dipilih ${r.kode.join(", ")}`;
  });
  await cek(admin, "2.2", "Simpan → diajukan", async () => {
    const { id, kode } = await simpanPeminjaman(admin, "TRX-001");
    const st = await statusPeminjaman(id);
    assert(st === "diajukan", `status ${st}`);
    return `${kode} diajukan`;
  });
  const id = pemetaan["TRX-001"]?.id;
  test.skip(!id, "TRX-001 gagal dibuat");

  await cek(sarpras, "2.3", "Pemasangan 2 foto → dipinjam; LPT-001 & PRJ-001 dipinjam", async () => {
    await pemasangan(sarpras, id, 2);
    const st = await statusPeminjaman(id);
    const a = await asetMap();
    assert(st === "dipinjam" && a["LPT-001"].status === "dipinjam" && a["PRJ-001"].status === "dipinjam", `status ${st}`);
    return "Dipinjam; LPT-001 & PRJ-001 dipinjam";
  });
  await cek(sarpras, "2.4", "Pengembalian baik semua, 2 foto → selesai; LPT-001 & PRJ-001 tersedia/baik", async () => {
    await sarpras.goto(`/peminjaman/${id}/pengembalian`);
    await isiPengembalian(sarpras, { "LPT-001": { k: "baik" }, "PRJ-001": { k: "baik" } });
    await pilihFoto(sarpras, foto.slice(2, 4));
    await simpanPengembalian(sarpras, id);
    const st = await statusPeminjaman(id);
    const a = await asetMap();
    assert(st === "selesai", `status ${st}`);
    for (const k of ["LPT-001", "PRJ-001"]) assert(a[k].status === "tersedia" && a[k].kondisi === "baik", `${k} ${a[k].status}/${a[k].kondisi}`);
    return "Selesai; LPT-001 & PRJ-001 tersedia/baik";
  });
});

test("Langkah 3 – TRX-002: terlambat", async () => {
  // Tanggal keluar 3 jam lalu supaya rencana kembali bisa dimundurkan ke 1 jam lalu (constraint kembali > keluar).
  await bukaFormBaru(admin, "TRX-002", witaInput(-3 * JAM), witaInput(5 * JAM));
  await cek(admin, "3.1", "Proyektor 1 + Webcam 1 → PRJ-001 dan WCM-002", async () => {
    await tambahUnit(admin, "Proyektor", 1);
    const r = await tambahUnit(admin, "Webcam", 1);
    assert(JSON.stringify(r.kode) === '["PRJ-001","WCM-002"]', `dipilih ${r.kode.join(", ")}`);
    return `Dipilih ${r.kode.join(", ")}`;
  });
  await cek(admin, "3.2", "Simpan → diajukan", async () => {
    const { id, kode } = await simpanPeminjaman(admin, "TRX-002");
    const st = await statusPeminjaman(id);
    assert(st === "diajukan", `status ${st}`);
    return `${kode} diajukan`;
  });
  const id = pemetaan["TRX-002"]?.id;
  test.skip(!id, "TRX-002 gagal dibuat");

  await cek(sarpras, "3.3", "Pemasangan 2 foto → dipinjam", async () => {
    await pemasangan(sarpras, id, 2);
    const st = await statusPeminjaman(id);
    assert(st === "dipinjam", `status ${st}`);
    return "Dipinjam";
  });

  await admin.goto("/");
  const terlambatSebelum = await kartuDashboard(admin, "Terlambat");

  await cek(null, "3.4", "Mundurkan rencana kembali 1 jam + jalankan fungsi cron → terlambat + notifikasi user peminjaman.view", async () => {
    const baru = new Date(Date.now() - JAM).toISOString();
    const { error: e1 } = await db.from("peminjaman").update({ tgl_rencana_kembali: baru }).eq("id", id);
    sqlLog.push({
      langkah: "3.4",
      sql: `update public.peminjaman set tgl_rencana_kembali = '${baru}' where id = ${id}; -- ${pemetaan["TRX-002"].kode}`,
      hasil: e1 ? `ERROR ${e1.message}` : "OK (1 baris)",
    });
    assert(!e1, e1?.message ?? "");
    const { data: n1, error: e2 } = await db.rpc("tandai_terlambat");
    sqlLog.push({ langkah: "3.4", sql: "select public.tandai_terlambat();", hasil: e2 ? `ERROR ${e2.message}` : `${n1} peminjaman ditandai` });
    assert(!e2, e2?.message ?? "");
    const st = await statusPeminjaman(id);
    const { data: n } = await db.from("notifikasi").select("user_id, pesan").eq("peminjaman_id", id).eq("jenis", "terlambat");
    const aid = await staffId(AKUN.admin.email);
    const sid = await staffId(AKUN.sarpras.email);
    assert(st === "terlambat", `status ${st}`);
    assert(n?.length === 2 && n.some((x) => x.user_id === aid) && n.some((x) => x.user_id === sid), `notifikasi: ${n?.length}`);
    return `Status terlambat (${n1} ditandai); notifikasi ke Admin & Sarpras: "${n![0].pesan}"`;
  });

  await cek(null, "3.5", "Jalankan fungsi cron lagi → tidak ada notifikasi ganda", async () => {
    const { data: n2, error } = await db.rpc("tandai_terlambat");
    sqlLog.push({ langkah: "3.5", sql: "select public.tandai_terlambat();", hasil: error ? `ERROR ${error.message}` : `${n2} peminjaman ditandai` });
    const { count } = await db.from("notifikasi").select("*", { count: "exact", head: true }).eq("peminjaman_id", id).eq("jenis", "terlambat");
    assert(count === 2, `jumlah notifikasi terlambat ${count}`);
    return `${n2} peminjaman ditandai pada run kedua; notifikasi terlambat tetap 2 (1 per user)`;
  });

  await cek(admin, "3.6", "Dashboard Admin: muncul di daftar Terlambat, kartu Terlambat bertambah", async () => {
    await admin.goto("/");
    const sesudah = await kartuDashboard(admin, "Terlambat");
    const section = admin.locator("section", { has: admin.getByRole("heading", { name: /^Terlambat/ }) });
    await expect(section.getByRole("link", { name: pemetaan["TRX-002"].kode })).toBeVisible();
    await shot(admin, "3.6-dashboard-terlambat");
    assert(sesudah === terlambatSebelum + 1, `kartu ${terlambatSebelum} → ${sesudah}`);
    return `Kartu Terlambat ${terlambatSebelum} → ${sesudah}; ${pemetaan["TRX-002"].kode} ada di tabel Terlambat`;
  });
});

test("Langkah 4 – TRX-003: perpanjangan dari TRX-002", async () => {
  const lama = pemetaan["TRX-002"];
  test.skip(!lama, "TRX-002 tidak ada");

  await cek(admin, "4.1", "Perpanjang (3 hari, alasan) → peminjaman baru, perpanjangan_dari = TRX-002, data & unit sama, kondisi keluar disalin", async () => {
    await admin.goto(`/peminjaman/${lama.id}`);
    await admin.getByRole("link", { name: "Perpanjang" }).click();
    await admin.waitForURL(/\/perpanjang$/);
    await admin.locator("#tgl_rencana_kembali").fill(witaInput(3 * HARI));
    await admin.locator("#alasan").fill("Pelatihan ditambah 2 sesi");
    await admin.getByRole("button", { name: "Perpanjang" }).click();
    await admin.waitForURL(/\/peminjaman\/\d+\?perpanjangan=1/);
    const id = Number(new URL(admin.url()).pathname.split("/")[2]);
    pemetaan["TRX-003"] = { id, kode: (await admin.locator("h1").first().innerText()).trim() };
    await shot(admin, "4.1-detail-perpanjangan");
    const { data: b } = await db.from("peminjaman")
      .select("perpanjangan_dari, nama_peminjam, divisi_peminjam, kontak_peminjam, ruangan, keperluan, detail_peminjaman(kondisi_keluar, aset(kode_aset))")
      .eq("id", id).single();
    const unit = b!.detail_peminjaman.map((d) => `${d.aset!.kode_aset}:${d.kondisi_keluar}`).sort();
    const p = PEMINJAM["TRX-002"];
    assert(b!.perpanjangan_dari === lama.id, `perpanjangan_dari ${b!.perpanjangan_dari}`);
    const { data: l } = await db.from("peminjaman").select("kontak_peminjam").eq("id", lama.id).single();
    assert(b!.nama_peminjam === p.nama && b!.ruangan === p.ruangan && b!.divisi_peminjam === p.divisi && b!.kontak_peminjam === l!.kontak_peminjam, "data peminjam berbeda");
    assert(JSON.stringify(unit) === '["PRJ-001:baik","WCM-002:baik"]', `unit ${unit}`);
    return `${pemetaan["TRX-003"].kode}: perpanjangan_dari=${lama.kode}, peminjam & ruangan sama, unit ${unit.join(", ")}, keperluan "${b!.keperluan.replace(/\n/g, " ")}"`;
  });

  const baru = pemetaan["TRX-003"];
  test.skip(!baru, "TRX-003 gagal dibuat");

  await cek(null, "4.2", "TRX-002 selesai tanpa pengembalian; TRX-003 dipinjam tanpa pemasangan", async () => {
    const s2 = await statusPeminjaman(lama.id);
    const s3 = await statusPeminjaman(baru.id);
    const { count: kembali } = await db.from("pengembalian").select("*", { count: "exact", head: true }).eq("peminjaman_id", lama.id);
    const { count: pasang } = await db.from("pemasangan").select("*", { count: "exact", head: true }).eq("peminjaman_id", baru.id);
    assert(s2 === "selesai" && s3 === "dipinjam" && kembali === 0 && pasang === 0, `TRX-002 ${s2}/${kembali}, TRX-003 ${s3}/${pasang}`);
    return `TRX-002 selesai (0 pengembalian); TRX-003 dipinjam (0 pemasangan)`;
  });

  await cek(null, "4.3", "PRJ-001 & WCM-002 tetap dipinjam", async () => {
    const a = await asetMap();
    assert(a["PRJ-001"].status === "dipinjam" && a["WCM-002"].status === "dipinjam", `${a["PRJ-001"].status}, ${a["WCM-002"].status}`);
    return "PRJ-001 dipinjam, WCM-002 dipinjam";
  });

  await cek(admin, "4.4", "Detail TRX-002 dan TRX-003 saling terhubung", async () => {
    await admin.goto(`/peminjaman/${lama.id}`);
    await expect(admin.getByText("Diperpanjang menjadi", { exact: false }).first()).toBeVisible();
    await expect(admin.getByRole("link", { name: baru.kode })).toBeVisible();
    await shot(admin, "4.4-detail-trx002");
    await admin.goto(`/peminjaman/${baru.id}`);
    await expect(admin.getByText("Perpanjangan dari", { exact: false }).first()).toBeVisible();
    await expect(admin.getByRole("link", { name: lama.kode })).toBeVisible();
    await shot(admin, "4.4-detail-trx003");
    return `${lama.kode} → "Diperpanjang menjadi ${baru.kode}"; ${baru.kode} → "Perpanjangan dari ${lama.kode}"`;
  });
});

test("Langkah 5 – TRX-005: permintaan melebihi stok", async () => {
  await bukaFormBaru(admin, "TRX-005");

  await cek(admin, "5.1", "Proyektor 3 → ditolak semua, 'hanya tersedia 2 unit Proyektor', tabel kosong", async () => {
    const r = await tambahUnit(admin, "Proyektor", 3);
    await shot(admin, "5.1-melebihi-stok");
    assert(r.error?.includes("Hanya tersedia 2 unit Proyektor"), `pesan: ${r.error}`);
    assert(r.kode.length === 0, `tabel berisi ${r.kode.join(", ")}`);
    return `Pesan: "${r.error}"; tabel kosong`;
  });

  await cek(admin, "5.2", "Proyektor 2 + Laptop 1 → PRJ-002, PRJ-003, LPT-001", async () => {
    await admin.getByRole("alert").filter({ hasText: /tersedia/ }).getByRole("button").click().catch(() => {});
    await tambahUnit(admin, "Proyektor", 2);
    const r = await tambahUnit(admin, "Laptop", 1);
    assert(JSON.stringify(r.kode) === '["PRJ-002","PRJ-003","LPT-001"]', `dipilih ${r.kode.join(", ")}`);
    return `Dipilih ${r.kode.join(", ")}`;
  });

  await cek(admin, "5.3", "Simpan → diajukan", async () => {
    const { id, kode } = await simpanPeminjaman(admin, "TRX-005");
    const st = await statusPeminjaman(id);
    assert(st === "diajukan", `status ${st}`);
    return `${kode} diajukan`;
  });

  await cek(admin, "5.4", "Tab lain: Proyektor 1 → ditolak (tidak ada proyektor tersedia); form tidak disimpan", async () => {
    const tab = await adminCtx.newPage();
    try {
      await bukaFormBaru(tab, "TRX-005");
      const r = await tambahUnit(tab, "Proyektor", 1);
      await shot(tab, "5.4-tab-lain-ditolak");
      assert(r.error?.includes("Hanya tersedia 0 unit Proyektor"), `pesan: ${r.error}`);
      assert(r.kode.length === 0, `tabel ${r.kode.join(", ")}`);
      return `Pesan: "${r.error}"; form ditutup tanpa disimpan`;
    } finally {
      await tab.close();
    }
  });

  await cek(admin, "5.5", "Riwayat aset LPT-001 menampilkan TRX-001 dan TRX-005", async () => {
    const a = await asetMap();
    await admin.goto(`/aset/${a["LPT-001"].id}`);
    await expect(admin.getByRole("link", { name: pemetaan["TRX-001"].kode })).toBeVisible();
    await expect(admin.getByRole("link", { name: pemetaan["TRX-005"].kode })).toBeVisible();
    await shot(admin, "5.5-riwayat-lpt001");
    return `Riwayat LPT-001 berisi ${pemetaan["TRX-001"].kode} (selesai) dan ${pemetaan["TRX-005"].kode} (diajukan)`;
  });
});

test("Pemeriksaan akhir", async () => {
  if (Object.keys(pemetaan).length === 0) {
    const { data } = await db.from("peminjaman").select("id, kode_peminjaman, nama_peminjam, perpanjangan_dari");
    for (const [label, d] of Object.entries(PEMINJAM)) {
      const r = data!.filter((x) => x.nama_peminjam === d.nama && !x.perpanjangan_dari);
      if (r[0]) pemetaan[label] = { id: r[0].id, kode: r[0].kode_peminjaman };
    }
    const ext = data!.find((x) => x.perpanjangan_dari);
    if (ext) pemetaan["TRX-003"] = { id: ext.id, kode: ext.kode_peminjaman };
  }
  const p = pemetaan;

  await cek(null, "A.1", "Status peminjaman: TRX-004/001/002 selesai, TRX-003 dipinjam, TRX-005 diajukan", async () => {
    const harap: Record<string, string> = { "TRX-004": "selesai", "TRX-001": "selesai", "TRX-002": "selesai", "TRX-003": "dipinjam", "TRX-005": "diajukan" };
    const beda: string[] = [];
    const isi: string[] = [];
    for (const [label, st] of Object.entries(harap)) {
      const s = p[label] ? await statusPeminjaman(p[label].id) : "tidak ada";
      isi.push(`${label}=${s}`);
      if (s !== st) beda.push(`${label}: ${s} (harap ${st})`);
    }
    assert(beda.length === 0, beda.join("; "));
    return isi.join(", ");
  });

  await cek(null, "A.2", "Status & kondisi aset sesuai tabel bagian 4", async () => {
    const harap: Record<string, [string, string | null]> = {
      "LPT-001": ["tersedia", "baik"], "LPT-002": ["dalam_perbaikan", "rusak"], "LPT-003": ["tersedia", "baik"],
      "PRJ-001": ["dipinjam", "baik"], "PRJ-002": ["tersedia", "baik"], "PRJ-003": ["tersedia", "baik"],
      "WCM-001": ["hilang", null], "WCM-002": ["dipinjam", "baik"],
    };
    const a = await asetMap();
    const beda = Object.entries(harap).filter(([k, [s, kd]]) => a[k].status !== s || (kd !== null && a[k].kondisi !== kd));
    assert(beda.length === 0, beda.map(([k]) => `${k}=${a[k].status}/${a[k].kondisi}`).join("; "));
    return Object.keys(harap).map((k) => `${k}=${a[k].status}/${a[k].kondisi}`).join(", ");
  });

  await cek(null, "A.3", "Unit terkunci TRX-005 (LPT-001, PRJ-002, PRJ-003) tidak bisa dipilih", async () => {
    const api = await apiSebagai(AKUN.admin.email, AKUN.admin.password);
    const { data: kat } = await db.from("kategori").select("id, kode_prefix");
    const tersedia: string[] = [];
    for (const k of kat!) tersedia.push(...((await api.rpc("aset_tersedia", { p_kategori_id: k.id })).data ?? []).map((x) => x.kode_aset));
    assert(JSON.stringify(tersedia.sort()) === '["LPT-003"]', `tersedia: ${tersedia.join(", ")}`);
    return `Yang masih bisa dipilih hanya: ${tersedia.join(", ")}`;
  });

  await cek(admin, "A.4", "Riwayat menampilkan kelima transaksi; cari nama & kode aset berjalan", async () => {
    await admin.goto("/riwayat");
    for (const label of Object.keys(p)) await expect(admin.getByRole("link", { name: p[label].kode })).toBeVisible();
    await shot(admin, "A.4-riwayat");
    await admin.locator("#q").fill("Sari Wulandari");
    await admin.getByRole("button", { name: "Terapkan" }).click();
    await admin.waitForURL(/q=Sari/);
    await expect(admin.getByText("dari 1 peminjaman")).toBeVisible();
    await expect(admin.getByRole("link", { name: p["TRX-004"].kode })).toBeVisible();
    await admin.locator("#q").fill("PRJ-001");
    await admin.getByRole("button", { name: "Terapkan" }).click();
    await admin.waitForURL(/q=PRJ-001/);
    await expect(admin.getByText("dari 3 peminjaman")).toBeVisible();
    for (const l of ["TRX-001", "TRX-002", "TRX-003"]) await expect(admin.getByRole("link", { name: p[l].kode })).toBeVisible();
    await shot(admin, "A.4-riwayat-cari-prj001");
    return `5 transaksi tampil; "Sari Wulandari" → ${p["TRX-004"].kode}; "PRJ-001" → ${["TRX-001", "TRX-002", "TRX-003"].map((l) => p[l].kode).join(", ")}`;
  });

  await cek(admin, "A.5", "Dashboard Admin & Sarpras: Diajukan 1, Dipinjam 1, Terlambat 0, Aset Tersedia 1", async () => {
    const angka = async (page: Page) => {
      await page.goto("/");
      return Promise.all(["Diajukan", "Dipinjam", "Terlambat", "Aset Tersedia"].map((l) => kartuDashboard(page, l)));
    };
    const a = await angka(admin);
    const s = await angka(sarpras);
    await shot(admin, "A.5-dashboard-admin");
    await shot(sarpras, "A.5-dashboard-sarpras");
    const harap = "[1,1,0,1]";
    assert(JSON.stringify(a) === harap && JSON.stringify(s) === harap, `admin ${a}, sarpras ${s}`);
    const menunggu = sarpras.locator("section", { has: sarpras.getByRole("heading", { name: /^Menunggu Pemasangan/ }) });
    await expect(menunggu.getByRole("link", { name: p["TRX-005"].kode })).toBeVisible();
    return `Admin ${a.join("/")}, Sarpras ${s.join("/")} (Diajukan/Dipinjam/Terlambat/Aset Tersedia); TRX-005 di "Menunggu Pemasangan" Sarpras`;
  });

  await cek(sarpras, "A.6", "Sarpras tidak bisa membuat, memperpanjang, membatalkan (UI & API)", async () => {
    const temuan: string[] = [];
    await sarpras.goto("/");
    await sarpras.getByRole("heading", { name: "Dashboard" }).waitFor();
    if (await sarpras.getByRole("link", { name: "Peminjaman Baru" }).count()) temuan.push("menu Peminjaman Baru tampil");
    const r403 = await sarpras.goto("/peminjaman/baru");
    if (!(await tertolak(sarpras))) temuan.push("/peminjaman/baru tidak 403");
    if (r403?.status() !== 403) temuan.push(`/peminjaman/baru status HTTP ${r403?.status()}`);
    await sarpras.goto(`/peminjaman/${p["TRX-003"].id}/perpanjang`);
    if (!(await tertolak(sarpras))) temuan.push("/perpanjang tidak 403");
    await sarpras.goto(`/peminjaman/${p["TRX-003"].id}`);
    await sarpras.getByRole("heading", { name: "Timeline" }).waitFor();
    if (await sarpras.getByRole("link", { name: "Perpanjang" }).count()) temuan.push("tombol Perpanjang tampil");
    await sarpras.goto(`/peminjaman/${p["TRX-005"].id}`);
    await sarpras.getByRole("heading", { name: "Timeline" }).waitFor();
    if (await sarpras.getByRole("button", { name: "Batalkan" }).count()) temuan.push("tombol Batalkan tampil");

    const api = await apiSebagai(AKUN.sarpras.email, AKUN.sarpras.password);
    const { data: lpt3 } = await db.from("aset").select("id").eq("kode_aset", "LPT-003").single();
    const r1 = await api.rpc("buat_peminjaman", {
      p_nama_peminjam: "X", p_divisi_peminjam: "X", p_kontak_peminjam: "0", p_ruangan: "X", p_keperluan: "X",
      p_tgl_peminjaman: new Date().toISOString(), p_tgl_rencana_kembali: new Date(Date.now() + JAM).toISOString(), p_aset_ids: [lpt3!.id],
    });
    const r2 = await api.rpc("perpanjang_peminjaman", { p_peminjaman_id: p["TRX-003"].id, p_tgl_rencana_kembali: new Date(Date.now() + 5 * HARI).toISOString(), p_alasan: "X" });
    const r3 = await api.rpc("batalkan_peminjaman", { p_peminjaman_id: p["TRX-005"].id });
    const r4 = await api.from("peminjaman").update({ status: "dibatalkan" }).eq("id", p["TRX-005"].id).select();
    if (!r1.error) temuan.push("RPC buat_peminjaman berhasil");
    if (!r2.error) temuan.push("RPC perpanjang_peminjaman berhasil");
    if (!r3.error) temuan.push("RPC batalkan_peminjaman berhasil");
    if (!r4.error && (r4.data?.length ?? 0) > 0) temuan.push("UPDATE langsung tabel peminjaman berhasil");
    const s5 = await statusPeminjaman(p["TRX-005"].id);
    if (s5 !== "diajukan") temuan.push(`TRX-005 berubah jadi ${s5}`);
    assert(temuan.length === 0, temuan.join("; "));
    return `UI: menu tidak ada, URL → 403, tombol tidak tampil. API ditolak: buat ("${r1.error!.message}"), perpanjang ("${r2.error!.message}"), batal ("${r3.error!.message}"), UPDATE tabel ("${r4.error?.message ?? "0 baris"}")`;
  });

  await cek(admin, "A.7", "Admin tidak bisa pemasangan & pengembalian (UI & API)", async () => {
    const temuan: string[] = [];
    await admin.goto(`/peminjaman/${p["TRX-005"].id}`);
    await admin.getByRole("heading", { name: "Timeline" }).waitFor();
    if (await admin.getByRole("link", { name: "Pemasangan" }).count()) temuan.push("tombol Pemasangan tampil");
    await admin.goto(`/peminjaman/${p["TRX-003"].id}`);
    await admin.getByRole("heading", { name: "Timeline" }).waitFor();
    if (await admin.getByRole("link", { name: "Pengembalian" }).count()) temuan.push("tombol Pengembalian tampil");
    const r403 = await admin.goto(`/peminjaman/${p["TRX-005"].id}/pemasangan`);
    if (!(await tertolak(admin))) temuan.push("/pemasangan tidak 403");
    if (r403?.status() !== 403) temuan.push(`/pemasangan status HTTP ${r403?.status()}`);
    await admin.goto(`/peminjaman/${p["TRX-003"].id}/pengembalian`);
    if (!(await tertolak(admin))) temuan.push("/pengembalian tidak 403");

    const api = await apiSebagai(AKUN.admin.email, AKUN.admin.password);
    const r1 = await api.rpc("reservasi_id_kejadian", { p_jenis: "pemasangan", p_peminjaman_id: p["TRX-005"].id });
    const r2 = await api.rpc("reservasi_id_kejadian", { p_jenis: "pengembalian", p_peminjaman_id: p["TRX-003"].id });
    const r3 = await api.rpc("simpan_pemasangan", { p_peminjaman_id: p["TRX-005"].id, p_pemasangan_id: 999999, p_units: [], p_foto: [] });
    const r4 = await api.rpc("simpan_pengembalian", { p_peminjaman_id: p["TRX-003"].id, p_pengembalian_id: 999999, p_units: [], p_foto: [] });
    const r5 = await api.storage.from("foto-peminjaman").upload(`pemasangan/999999/${crypto.randomUUID()}.jpg`, fs.readFileSync(foto[0]), { contentType: "image/jpeg" });
    if (!r1.error) temuan.push("reservasi pemasangan berhasil");
    if (!r2.error) temuan.push("reservasi pengembalian berhasil");
    if (!r3.error) temuan.push("simpan_pemasangan berhasil");
    if (!r4.error) temuan.push("simpan_pengembalian berhasil");
    if (!r5.error) temuan.push("upload foto pemasangan berhasil");
    assert(temuan.length === 0, temuan.join("; "));
    return `UI: tombol tidak tampil, URL → 403. API ditolak: reservasi ("${r1.error!.message}"), simpan_pemasangan ("${r3.error!.message}"), simpan_pengembalian ("${r4.error!.message}"), upload Storage ("${r5.error!.message}")`;
  });

  const gagal = (await import("./support")).hasil.filter((h) => h.status === "gagal");
  expect(gagal.map((g) => `${g.langkah}: ${g.hasil}`)).toEqual([]);
});
