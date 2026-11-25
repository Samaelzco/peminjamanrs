/**
 * Uji halaman /debug.
 * Bagian aman (tanpa reset) selalu jalan. Reset sungguhan HANYA jika RUN_RESET=1
 * (menghapus semua transaksi di database!).
 */
import { expect, test, type Page } from "@playwright/test";
import { AKUN, apiSebagai, db } from "./support";

async function login(page: Page, akun: { email: string; password: string }) {
  await page.goto("/login");
  await page.locator("#email").fill(akun.email);
  await page.locator("#password").fill(akun.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test("Admin: menu Debug disembunyikan, halaman /debug tetap bisa dibuka; tombol aktif hanya setelah ketik RESET", async ({ page }) => {
  await login(page, AKUN.admin);
  await expect(page.getByRole("link", { name: "Debug" })).toHaveCount(0);
  const res = await page.goto("/debug");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Isi Database Saat Ini" })).toBeVisible();
  const tombol = page.getByRole("button", { name: "Reset Data Demo" });
  await expect(tombol).toBeDisabled();
  await page.locator("#konfirmasi").fill("reset");
  await expect(tombol).toBeDisabled();
  await page.locator("#konfirmasi").fill("RESET");
  await expect(tombol).toBeEnabled();
  await page.screenshot({ path: "tests/screenshots/debug-page.png", fullPage: true });
});

test("Sarpras: tidak ada menu Debug, /debug → 403", async ({ page }) => {
  await login(page, AKUN.sarpras);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Debug" })).toHaveCount(0);
  const res = await page.goto("/debug");
  expect(res?.status()).toBe(403);
});

test("Fungsi reset_data_demo tidak bisa dipanggil user aplikasi lewat API", async () => {
  for (const akun of [AKUN.admin, AKUN.sarpras]) {
    const api = await apiSebagai(akun.email, akun.password);
    const { error } = await api.rpc("reset_data_demo");
    expect(error, akun.email).toBeTruthy();
  }
});

test("Reset sungguhan (RUN_RESET=1)", async ({ page }) => {
  test.skip(process.env.RUN_RESET !== "1", "Lewati: set RUN_RESET=1 untuk menjalankan reset sungguhan.");
  await login(page, AKUN.admin);
  await page.goto("/debug");
  await page.waitForLoadState("networkidle");
  await page.locator("#konfirmasi").fill("RESET");
  await page.getByRole("button", { name: "Reset Data Demo" }).click();
  await expect(page.getByText(/Reset selesai/)).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: "tests/screenshots/debug-setelah-reset.png", fullPage: true });

  const { count: pjm } = await db.from("peminjaman").select("*", { count: "exact", head: true });
  const { count: notif } = await db.from("notifikasi").select("*", { count: "exact", head: true });
  const { data: aset } = await db.from("aset").select("kode_aset, status, kondisi").order("kode_aset");
  expect(pjm).toBe(0);
  expect(notif).toBe(0);
  expect(aset!.map((a) => `${a.kode_aset}:${a.status}/${a.kondisi}`)).toEqual(
    ["TI-CAM-001", "TI-CAM-002", "TI-LPT-001", "TI-LPT-002", "TI-LPT-003", "TI-LPT-004", "TI-PRJ-001", "TI-PRJ-002"].map(
      (k) => `${k}:tersedia/baik`,
    ),
  );
  const { data: kat } = await db.from("kategori").select("nama, kode_prefix").order("nama");
  expect(kat!.map((k) => `${k.nama}:${k.kode_prefix}`)).toEqual([
    "Conf-Cam:TI-CAM", "Laptop:TI-LPT", "Proyektor:TI-PRJ", "Webcam:TI-CAM",
  ]);
  for (const root of ["pemasangan", "pengembalian"]) {
    const { data } = await db.storage.from("foto-peminjaman").list(root);
    expect(data ?? []).toHaveLength(0);
  }
  await expect(page.getByText("Total peminjaman").locator("xpath=following-sibling::p")).toHaveText("0");
});
