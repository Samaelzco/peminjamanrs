// Ukur waktu muat halaman (server produksi). Jalankan server dulu:
//   npm run build && npx next start -p 3123
// lalu: npx tsx --env-file=.env.local scripts/tests/bench.ts
import { admin, cleanupUser, tempUser } from "./helpers";
import { sessionCookie } from "./session";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3123";
const ULANG = Number(process.env.BENCH_ULANG ?? 8);

async function ukur(path: string, cookie: string, rsc: boolean) {
  const t = performance.now();
  const r = await fetch(BASE + path, {
    headers: { cookie, ...(rsc ? { RSC: "1", "Next-Router-State-Tree": "" } : {}) },
    redirect: "manual",
  });
  await r.text();
  return { ms: performance.now() - t, status: r.status };
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function main() {
  const adm = await tempUser("Administrasi", "bench");
  try {
    const cookie = await sessionCookie(adm.email, adm.password);
    const { data: p } = await admin.from("peminjaman").select("id").order("id", { ascending: false }).limit(1);
    const paths = ["/", "/riwayat", "/aset", "/akun", ...(p?.[0] ? [`/peminjaman/${p[0].id}`] : [])];

    for (const path of paths) await ukur(path, cookie, false); // pemanasan

    console.log(`Median ${ULANG}x (${BASE})`);
    for (const path of paths) {
      const html: number[] = [];
      let status = 0;
      for (let i = 0; i < ULANG; i++) {
        const r = await ukur(path, cookie, false);
        html.push(r.ms);
        status = r.status;
      }
      console.log(`  ${path.padEnd(18)} ${String(Math.round(median(html))).padStart(5)} ms  (status ${status})`);
    }
  } finally {
    await cleanupUser(adm.id);
  }
}

main();
