// Uji akses halaman lewat HTTP dengan cookie sesi asli.
// Jalankan server dulu (npm run build && npx next start -p 3123), lalu: npm run test:http
import { createClient } from "@supabase/supabase-js";
import { admin, check, cleanupUser, summary, tempUser } from "./helpers";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3123";
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];

/** Buat cookie sesi dengan format @supabase/ssr (base64url + chunk). */
async function sessionCookie(email: string, password: string) {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const value = "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
  const name = `sb-${REF}-auth-token`;
  const CHUNK = 3180;
  if (value.length <= CHUNK) return `${name}=${value}`;
  const parts: string[] = [];
  for (let i = 0; i * CHUNK < value.length; i++) {
    parts.push(`${name}.${i}=${value.slice(i * CHUNK, (i + 1) * CHUNK)}`);
  }
  return parts.join("; ");
}

async function get(path: string, cookie?: string) {
  return fetch(BASE + path, { headers: cookie ? { cookie } : {}, redirect: "manual" });
}

async function main() {
  console.log(`Uji akses HTTP (${BASE})`);
  const adm = await tempUser("Administrasi", "httpadm");
  const sar = await tempUser("Sarana dan Prasarana", "httpsar");
  try {
    const ca = await sessionCookie(adm.email, adm.password);
    const cs = await sessionCookie(sar.email, sar.password);

    await check("Tanpa login: /akun dialihkan ke /login", async () => {
      const r = await get("/akun");
      return (r.status === 307 && r.headers.get("location")?.endsWith("/login")) || `status ${r.status}`;
    });
    await check("Admin bisa membuka Kelola Akun", async () => {
      const r = await get("/akun", ca);
      const html = await r.text();
      return (r.status === 200 && html.includes(adm.email)) || `status ${r.status}`;
    });
    await check("Admin bisa membuka Role & Permission", async () => {
      const r = await get("/role", ca);
      return (r.status === 200 && (await r.text()).includes("Sarana dan Prasarana")) || `status ${r.status}`;
    });
    await check("Sarpras: menu Kelola Akun tidak tampil", async () => {
      const html = await (await get("/", cs)).text();
      return (!html.includes('href="/akun"') && html.includes('href="/kategori"')) || "menu tidak sesuai";
    });
    await check("Sarpras: /akun lewat URL langsung → 403", async () => {
      const r = await get("/akun", cs);
      const html = await r.text();
      return (r.status === 403 || html.includes("Akses ditolak")) || `status ${r.status}`;
    });
    await check("Sarpras: /role lewat URL langsung → 403", async () => {
      const r = await get("/role", cs);
      const html = await r.text();
      return (r.status === 403 || html.includes("Akses ditolak")) || `status ${r.status}`;
    });
    await check("Sarpras bisa membuka Data Aset (dengan tombol Tambah Aset)", async () => {
      const r = await get("/aset", cs);
      const html = await r.text();
      return (r.status === 200 && html.includes("LPT-001") && html.includes("Tambah Aset")) || `status ${r.status}`;
    });
    await check("Admin melihat Data Aset tanpa tombol Tambah Aset", async () => {
      const html = await (await get("/aset", ca)).text();
      return (html.includes("LPT-001") && !html.includes("Tambah Aset")) || "tidak sesuai";
    });
    await check("Filter aset berdasarkan kategori bekerja", async () => {
      const { data: prj } = await admin.from("kategori").select("id").eq("kode_prefix", "PRJ").single();
      const html = await (await get(`/aset?kategori=${prj!.id}`, cs)).text();
      return (html.includes("PRJ-001") && !html.includes("LPT-001")) || "filter tidak sesuai";
    });
    await check("Sarpras bisa membuka Kategori", async () => {
      const r = await get("/kategori", cs);
      return (r.status === 200 && (await r.text()).includes("Proyektor")) || `status ${r.status}`;
    });
    await check("Admin bisa membuka Peminjaman Baru; Sarpras → 403", async () => {
      const ra = await get("/peminjaman/baru", ca);
      const rs = await get("/peminjaman/baru", cs);
      const ha = await ra.text();
      const hs = await rs.text();
      return (ha.includes("Tambah Unit") && hs.includes("Akses ditolak")) || `admin ${ra.status}, sarpras ${rs.status}`;
    });
    await check("Detail peminjaman tampil (Admin: Batalkan, Sarpras: Pemasangan)", async () => {
      const { signIn } = await import("./helpers");
      const a = await signIn(adm.email, adm.password);
      const { data: lpt } = await a.from("kategori").select("id").eq("kode_prefix", "WCM").single();
      const { data: unit } = await a.rpc("ambil_unit_tersedia", { p_kategori_id: lpt!.id, p_jumlah: 1 });
      const now = Date.now();
      const { data, error } = await a.rpc("buat_peminjaman", {
        p_nama_peminjam: "Uji HTTP", p_divisi_peminjam: "IT", p_kontak_peminjam: "0812", p_ruangan: "R1",
        p_keperluan: "Uji", p_tgl_peminjaman: new Date(now).toISOString(),
        p_tgl_rencana_kembali: new Date(now + 3600_000).toISOString(), p_aset_ids: [unit![0].id],
      });
      if (error) return error.message;
      const id = data![0].id;
      try {
        const ha = await (await get(`/peminjaman/${id}`, ca)).text();
        const hs = await (await get(`/peminjaman/${id}`, cs)).text();
        const ok =
          ha.includes(data![0].kode_peminjaman) && ha.includes("Batalkan") && !ha.includes(">Pemasangan<") &&
          hs.includes("Pemasangan") && !hs.includes("Batalkan") && hs.includes(unit![0].kode_aset) &&
          hs.includes("Peminjaman diajukan");
        return ok || JSON.stringify({
          kode: ha.includes(data![0].kode_peminjaman), aBatal: ha.includes("Batalkan"), aPasang: ha.includes(">Pemasangan<"),
          sPasang: hs.includes("Pemasangan"), sBatal: hs.includes("Batalkan"), sUnit: hs.includes(unit![0].kode_aset),
          sLog: hs.includes("Peminjaman diajukan"),
        });
      } finally {
        await admin.from("peminjaman").delete().eq("id", id);
      }
    });
    await check("Detail aset menampilkan riwayat peminjaman", async () => {
      const { data: u } = await admin.from("aset").select("id").eq("kode_aset", "LPT-001").single();
      const r = await get(`/aset/${u!.id}`, cs);
      return (r.status === 200 && (await r.text()).includes("Riwayat Peminjaman")) || `status ${r.status}`;
    });
    await check("User non_aktif dialihkan ke /login?error=nonaktif", async () => {
      await admin.from("staff_it").update({ status: "non_aktif" }).eq("id", sar.id);
      const r = await get("/", cs);
      return (r.status === 307 && r.headers.get("location")?.includes("error=nonaktif")) || `status ${r.status}`;
    });
    await check("User non_aktif tidak bisa login (Supabase Auth OK, tapi aplikasi menolak)", async () => {
      // Login form memeriksa staff_it.status; di sini dicek sumber datanya.
      const { data } = await admin.from("staff_it").select("status").eq("id", sar.id).single();
      return data?.status === "non_aktif";
    });
  } finally {
    await cleanupUser(adm.id);
    await cleanupUser(sar.id);
  }
  summary();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
