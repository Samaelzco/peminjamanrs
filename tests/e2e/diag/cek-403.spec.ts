import { test } from "@playwright/test";
import { AKUN, db } from "../support";

test("diagnosa 403 (read-only)", async ({ browser }) => {
  const { data } = await db.from("peminjaman").select("id, kode_peminjaman").in("kode_peminjaman", ["PJM-0004", "PJM-0005"]);
  const id = (k: string) => data!.find((d) => d.kode_peminjaman === k)!.id;
  const kasus = [
    { akun: AKUN.sarpras, url: "/peminjaman/baru" },
    { akun: AKUN.sarpras, url: `/peminjaman/${id("PJM-0004")}/perpanjang` },
    { akun: AKUN.admin, url: `/peminjaman/${id("PJM-0005")}/pemasangan` },
    { akun: AKUN.admin, url: `/peminjaman/${id("PJM-0004")}/pengembalian` },
  ];
  for (const k of kasus) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.locator("#email").fill(k.akun.email);
    await page.locator("#password").fill(k.akun.password);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    const res = await page.goto(k.url);
    const langsung = await page.getByText("Akses ditolak").isVisible();
    await page.waitForLoadState("networkidle");
    const setelahTunggu = await page.getByText("Akses ditolak").isVisible();
    const h1 = await page.locator("h1").first().textContent().catch(() => null);
    console.log(`${k.akun.email} ${k.url} → HTTP ${res?.status()} | langsung: ${langsung} | setelah networkidle: ${setelahTunggu} | h1: ${h1}`);
    await page.screenshot({ path: `tests/screenshots/diag-${k.url.replace(/\W+/g, "_")}.png` });
    await ctx.close();
  }
});
