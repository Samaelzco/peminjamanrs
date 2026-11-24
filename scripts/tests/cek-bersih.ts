import { admin } from "./helpers";
async function main() {
  const { data: aset } = await admin.from("aset").select("kode_aset, status, kondisi").order("kode_aset");
  const { count: pjm } = await admin.from("peminjaman").select("*", { count: "exact", head: true });
  const { count: notif } = await admin.from("notifikasi").select("*", { count: "exact", head: true });
  const { data: staff } = await admin.from("staff_it").select("email");
  const files: string[] = [];
  for (const root of ["pemasangan", "pengembalian"]) {
    const { data } = await admin.storage.from("foto-peminjaman").list(root);
    for (const d of data ?? []) files.push(`${root}/${d.name}`);
  }
  console.log(JSON.stringify({ aset: aset?.map((a) => `${a.kode_aset}:${a.status}/${a.kondisi}`), peminjaman: pjm, notifikasi: notif, staff: staff?.map((s) => s.email), storageFolders: files }, null, 1));
}
main();
