import { test } from "@playwright/test";
import { AKUN } from "../support";

test("screenshot form tanpa caption (read-only)", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#email").fill(AKUN.admin.email);
  await page.locator("#password").fill(AKUN.admin.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.goto("/peminjaman/baru");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "tests/screenshots/form-peminjaman-tanpa-caption.png", fullPage: true });
});

test("pratinjau foto di Pemasangan tanpa caption (tidak disimpan)", async ({ page }) => {
  const { db } = await import("../support");
  const { data: p } = await db.from("peminjaman").select("id").eq("status", "diajukan").limit(1).single();
  await page.goto("/login");
  await page.locator("#email").fill(AKUN.sarpras.email);
  await page.locator("#password").fill(AKUN.sarpras.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.goto(`/peminjaman/${p!.id}/pemasangan`);
  await page.waitForLoadState("networkidle");
  await page.locator('input[type="file"][multiple]').setInputFiles(["tests/fixtures/foto-dummy-1.jpg", "tests/fixtures/foto-dummy-2.jpg"]);
  await test.expect(page.getByAltText("Pratinjau foto")).toHaveCount(2, { timeout: 30_000 });
  await test.expect(page.getByText(/Minimal 1 foto|Foto otomatis dikompres/)).toHaveCount(0);
  await page.screenshot({ path: "tests/screenshots/pemasangan-tanpa-caption.png", fullPage: true });
});
