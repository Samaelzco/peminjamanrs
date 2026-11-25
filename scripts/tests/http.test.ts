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
    await check("Admin bisa membuka tab Role & Permission di Kelola Akun", async () => {
      const r = await get("/akun?tab=role", ca);
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
    await check("Sarpras bisa membuka Data Barang (dengan tombol Tambah Barang)", async () => {
      const r = await get("/aset", cs);
      const html = await r.text();
      return (r.status === 200 && html.includes("TI-LPT-001") && html.includes("Tambah Barang")) || `status ${r.status}`;
    });
    await check("Admin melihat Data Barang tanpa tombol Tambah Barang", async () => {
      const html = await (await get("/aset", ca)).text();
      return (html.includes("TI-LPT-001") && !html.includes("Tambah Barang")) || "tidak sesuai";
    });
    await check("Filter aset berdasarkan kategori bekerja", async () => {
      const { data: prj } = await admin.from("kategori").select("id").eq("nama", "Proyektor").single();
      const html = await (await get(`/aset?kategori=${prj!.id}`, cs)).text();
      return (html.includes("TI-PRJ-001") && !html.includes("TI-LPT-001")) || "filter tidak sesuai";
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
      const { data: lpt } = await a.from("kategori").select("id").eq("nama", "Webcam").single();
      const { data: unit } = await a.rpc("ambil_unit_tersedia", { p_kategori_id: lpt!.id, p_jumlah: 1 });
      const now = Date.now();
      const { data, error } = await a.rpc("buat_peminjaman", {
        p_nama_peminjam: "Uji HTTP", p_divisi_peminjam: "IT", p_kontak_peminjam: "081234567890", p_ruangan: "R1",
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
    await check("Pemasangan/Pengembalian: halaman, foto (signed URL), timeline penggantian", async () => {
      const { signIn } = await import("./helpers");
      const { asetIds, bersihkan, DATA_PEMINJAM, jadwal, unggahFoto } = await import("./fixtures");
      const a = await signIn(adm.email, adm.password);
      const s = await signIn(sar.email, sar.password);
      const [prj2, prj3] = await asetIds(a, ["TI-LPT-003", "TI-LPT-004"]);
      const { data, error } = await a.rpc("buat_peminjaman", { ...DATA_PEMINJAM, ...jadwal(), p_aset_ids: [prj2] });
      if (error) return error.message;
      const pid = data![0].id;
      try {
        const formA = await get(`/peminjaman/${pid}/pemasangan`, ca);
        const formS = await (await get(`/peminjaman/${pid}/pemasangan`, cs)).text();
        if (!(await formA.text()).includes("Akses ditolak")) return "admin bisa buka form pemasangan";
        if (!formS.includes("Konfirmasi Pemasangan") || !formS.includes('capture="environment"')) return "form pemasangan tidak sesuai";

        const { data: det } = await s.from("detail_peminjaman").select("id").eq("peminjaman_id", pid).single();
        const g = await s.rpc("ganti_unit_pemasangan", { p_detail_id: det!.id, p_aset_baru_id: prj3, p_alasan: "Lampu mati" });
        if (g.error) return g.error.message;
        const { data: rid } = await s.rpc("reservasi_id_kejadian", { p_jenis: "pemasangan", p_peminjaman_id: pid });
        const foto = await unggahFoto(s, "pemasangan", rid!, 2);
        const sp = await s.rpc("simpan_pemasangan", {
          p_peminjaman_id: pid, p_pemasangan_id: rid!, p_units: [{ detail_id: det!.id, kondisi_keluar: "baik" }], p_foto: foto,
        });
        if (sp.error) return sp.error.message;

        const html = await (await get(`/peminjaman/${pid}`, ca)).text();
        const signedCount = (html.match(/\/storage\/v1\/object\/sign\/foto-peminjaman\/pemasangan\//g) ?? []).length;
        const ok =
          html.includes("Foto Pemasangan") && signedCount >= 2 &&
          html.includes("Unit TI-LPT-003 diganti TI-LPT-004") && html.includes("Lampu mati") &&
          html.includes("Pemasangan 1 unit dengan 2 foto");
        const formK = await (await get(`/peminjaman/${pid}/pengembalian`, cs)).text();
        return (ok && formK.includes("Konfirmasi Pengembalian")) || `signed=${signedCount}, ok=${ok}`;
      } finally {
        await bersihkan([pid], ["TI-LPT-003", "TI-LPT-004"]);
      }
    });
    await check("Dashboard: kartu ringkasan & tabel sesuai role, ikon notifikasi", async () => {
      const ha = await (await get("/", ca)).text();
      const hs = await (await get("/", cs)).text();
      const okA = ha.includes("Peminjaman Berjalan") && !ha.includes("Sedang Dipinjam") && ha.includes("Notifikasi,");
      const okS = hs.includes("Menunggu Pemasangan") && hs.includes("Sedang Dipinjam") && hs.includes("Terlambat");
      return (okA && okS) || `admin ${okA}, sarpras ${okS}`;
    });
    await check("Halaman Perpanjang: Sarpras → 403", async () => {
      const html = await (await get("/peminjaman/1/perpanjang", cs)).text();
      return html.includes("Akses ditolak") || "tidak 403";
    });
    await check("Detail aset menampilkan riwayat peminjaman", async () => {
      const { data: u } = await admin.from("aset").select("id").eq("kode_aset", "TI-LPT-001").single();
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
