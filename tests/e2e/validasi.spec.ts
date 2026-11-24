/**
 * Uji validasi input, format tanggal (T3), modal Ganti (T2), dan status HTTP 403 (T1).
 * Tidak menyimpan data apa pun: setiap simpan memang diharapkan ditolak.
 * Jalankan: npx playwright test tests/e2e/validasi.spec.ts
 */
import { expect, test, type Page } from "@playwright/test";
import { AKUN, apiSebagai, db, HARI, JAM, witaInput } from "./support";

test.describe.configure({ mode: "serial" });

async function login(page: Page, akun: { email: string; password: string }) {
  await page.goto("/login");
  await page.locator("#email").fill(akun.email);
  await page.locator("#password").fill(akun.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

async function jumlahPeminjaman() {
  const { count } = await db.from("peminjaman").select("*", { count: "exact", head: true });
  return count ?? 0;
}

test("Form Peminjaman Baru: sanitasi & validasi", async ({ page }) => {
  await login(page, AKUN.admin);
  const sebelum = await jumlahPeminjaman();
  await page.goto("/peminjaman/baru");
  await page.waitForLoadState("networkidle"); // tunggu hydrate React sebelum mengetik

  await test.step("Nomor kontak: huruf & simbol dibuang, maksimal 15 angka", async () => {
    const kontak = page.locator("#kontak_peminjam");
    await kontak.pressSequentially("08ab12-cd34 xyz56789012345");
    await expect(kontak).toHaveValue("081234567890123");
    await expect(kontak).toHaveAttribute("maxlength", "15");
  });

  await test.step("Jumlah: hanya angka", async () => {
    const jumlah = page.locator("#jumlah");
    await jumlah.fill("");
    await jumlah.pressSequentially("1e5a");
    await expect(jumlah).toHaveValue("15");
    await jumlah.fill("1");
  });

  await test.step("Batas panjang teks (maxlength)", async () => {
    await expect(page.locator("#nama_peminjam")).toHaveAttribute("maxlength", "100");
    await expect(page.locator("#divisi_peminjam")).toHaveAttribute("maxlength", "100");
    await expect(page.locator("#ruangan")).toHaveAttribute("maxlength", "100");
    await expect(page.locator("#keperluan")).toHaveAttribute("maxlength", "500");
    await page.locator("#keperluan").fill("Rapat");
    await expect(page.getByText("5/500 karakter")).toBeVisible();
  });

  await test.step("T3: tanggal tampil dd/MM/yyyy HH:mm, masker otomatis, tanggal mustahil ditolak", async () => {
    const keluar = page.locator("#tgl_peminjaman");
    await expect(keluar).toHaveValue(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    await keluar.fill("");
    await keluar.pressSequentially("310220261000");
    await expect(keluar).toHaveValue("31/02/2026 10:00");
    await keluar.blur();
    await expect(page.getByText("Tidak valid. Format: dd/mm/yyyy jj:mm (24 jam).").first()).toBeVisible();
  });

  await test.step("T2: Ganti membuka modal (bukan dropdown di dalam tabel)", async () => {
    await page.locator("#kategori").selectOption({ label: "Laptop" });
    await page.getByRole("button", { name: "Tambah Unit" }).click();
    const row = page.locator("table tbody tr").filter({ hasText: /LPT-\d{3}/ }).first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Ganti" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Ganti Unit LPT-/)).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/T2-modal-ganti.png", fullPage: true });
    await dialog.getByRole("button", { name: "Batal" }).click();
    await expect(dialog).toBeHidden();
    // Tombol aksi tetap utuh di dalam tabel.
    await expect(row.getByRole("button", { name: "Hapus" })).toBeVisible();
  });

  await test.step("Server menolak isian tidak valid (nama berangka, kontak pendek, durasi > 30 hari)", async () => {
    await page.locator("#nama_peminjam").fill("Budi123");
    await page.locator("#kontak_peminjam").fill("0812");
    await page.locator("#divisi_peminjam").fill("Radiologi");
    await page.locator("#ruangan").fill("R. Rapat");
    await page.locator("#tgl_peminjaman").fill(witaInput(0));
    await page.locator("#tgl_rencana_kembali").fill(witaInput(40 * HARI));
    await page.getByRole("button", { name: "Simpan Peminjaman" }).click();
    await expect(page.getByText("Periksa kembali isian Anda.")).toBeVisible();
    await expect(page.getByText(/Nama peminjam hanya boleh berisi huruf/)).toBeVisible();
    await expect(page.getByText("Nomor kontak minimal 10 angka.")).toBeVisible();
    await expect(page.getByText("Lama peminjaman maksimal 30 hari.")).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/validasi-form-peminjaman.png", fullPage: true });
  });

  await test.step("Kontak harus diawali 0/62 & tanggal keluar maksimal 7 hari ke belakang", async () => {
    await page.locator("#nama_peminjam").fill("dr. Ayu Pratiwi");
    await page.locator("#kontak_peminjam").fill("1812345678");
    await page.locator("#tgl_peminjaman").fill(witaInput(-10 * HARI));
    await page.locator("#tgl_rencana_kembali").fill(witaInput(-9 * HARI));
    await page.getByRole("button", { name: "Simpan Peminjaman" }).click();
    await expect(page.getByText("Nomor kontak harus diawali 0 atau 62.")).toBeVisible();
    await expect(page.getByText("Tanggal keluar paling lama 7 hari ke belakang.")).toBeVisible();
  });

  expect(await jumlahPeminjaman()).toBe(sebelum);
});

test("Lapis database: CHECK constraint menolak kontak berhuruf & teks kepanjangan (API langsung)", async () => {
  const api = await apiSebagai(AKUN.admin.email, AKUN.admin.password);
  const { data: lpt3 } = await db.from("aset").select("id").eq("kode_aset", "LPT-003").single();
  const dasar = {
    p_nama_peminjam: "Uji", p_divisi_peminjam: "IT", p_ruangan: "R1", p_keperluan: "Uji",
    p_tgl_peminjaman: new Date().toISOString(), p_tgl_rencana_kembali: new Date(Date.now() + JAM).toISOString(),
    p_aset_ids: [lpt3!.id],
  };
  const r1 = await api.rpc("buat_peminjaman", { ...dasar, p_kontak_peminjam: "08abc12345" });
  const r2 = await api.rpc("buat_peminjaman", { ...dasar, p_kontak_peminjam: "081234567890", p_nama_peminjam: "x".repeat(101) });
  expect(r1.error?.code).toBe("23514");
  expect(r1.error?.message).toContain("peminjaman_kontak_format");
  expect(r2.error?.code).toBe("23514");
  expect(r2.error?.message).toContain("peminjaman_nama_panjang");
});

test("Kategori: kode prefix hanya huruf kapital; Akun: aturan password", async ({ browser }) => {
  let page = await (await browser.newContext()).newPage();
  await login(page, AKUN.sarpras);
  await page.goto("/kategori");
  await page.waitForLoadState("networkidle"); // tunggu hydrate React sebelum mengetik
  await page.getByRole("button", { name: "Tambah Kategori" }).click();
  const prefix = page.locator("#kode_prefix");
  await prefix.pressSequentially("ab1-c");
  await expect(prefix).toHaveValue("ABC");
  await page.getByRole("button", { name: "Batal" }).click();

  page = await (await browser.newContext()).newPage();
  await login(page, AKUN.admin);
  await page.goto("/akun");
  await page.waitForLoadState("networkidle"); // tunggu hydrate React sebelum mengetik
  await page.getByRole("button", { name: "Tambah Akun" }).click();
  await page.locator("#nama").fill("Petugas Uji");
  await page.locator("#email").fill("uji.validasi@example.test");
  await page.locator("#password").fill("passwordsaja");
  await page.locator("#role_id").selectOption({ label: "Sarana dan Prasarana" });
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Password harus mengandung angka.")).toBeVisible();
  await page.getByRole("button", { name: "Batal" }).click();
  const { count } = await db.from("staff_it").select("*", { count: "exact", head: true }).eq("email", "uji.validasi@example.test");
  expect(count).toBe(0);
});

test("T1: halaman tanpa izin → status HTTP 403 + 'Akses ditolak'", async ({ browser }) => {
  let page = await (await browser.newContext()).newPage();
  await login(page, AKUN.sarpras);
  for (const url of ["/akun", "/role", "/peminjaman/baru"]) {
    const res = await page.goto(url);
    expect(res?.status(), url).toBe(403);
    await expect(page.getByRole("heading", { name: "Akses ditolak" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(url); // URL tidak berubah
  }
  const ok = await page.goto("/aset");
  expect(ok?.status()).toBe(200);

  page = await (await browser.newContext()).newPage();
  await login(page, AKUN.admin);
  const { data: p } = await db.from("peminjaman").select("id").eq("status", "diajukan").limit(1).maybeSingle();
  if (p) {
    const res = await page.goto(`/peminjaman/${p.id}/pemasangan`);
    expect(res?.status()).toBe(403);
  }
});
