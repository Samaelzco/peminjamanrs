// Bersihkan sisa data uji (akun test.*@example.test dan transaksinya).
import { admin } from "./helpers";
import { bersihkan } from "./fixtures";
async function main() {
  const { data: staff } = await admin.from("staff_it").select("id, email").like("email", "test.%@example.test");
  const ids = (staff ?? []).map((s) => s.id);
  const { data: pjm } = ids.length
    ? await admin.from("peminjaman").select("id").in("dicatat_oleh", ids)
    : { data: [] };
  const { data: aset } = await admin.from("aset").select("kode_aset");
  await bersihkan((pjm ?? []).map((p) => p.id), (aset ?? []).map((a) => a.kode_aset));
  for (const id of ids) await admin.auth.admin.deleteUser(id);
  console.log(`Dihapus: ${pjm?.length ?? 0} peminjaman uji, ${ids.length} akun uji.`);
}
main();
