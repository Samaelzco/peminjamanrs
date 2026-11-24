import { randomUUID } from "node:crypto";
import { admin, type Db } from "./helpers";

export const DATA_PEMINJAM = {
  p_nama_peminjam: "Uji Peminjam",
  p_divisi_peminjam: "Instalasi Uji",
  p_kontak_peminjam: "081234567890",
  p_ruangan: "Ruang Rapat Uji",
  p_keperluan: "Pengujian otomatis",
};

export function jadwal(jamMulai = 0, durasiJam = 4) {
  const start = new Date(Date.now() + jamMulai * 3600_000);
  const end = new Date(start.getTime() + durasiJam * 3600_000);
  return { p_tgl_peminjaman: start.toISOString(), p_tgl_rencana_kembali: end.toISOString() };
}

// JPEG 1x1 yang valid.
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

/** Unggah n foto ke Storage sebagai user `db`; kembalikan path-nya. */
export async function unggahFoto(db: Db, jenis: "pemasangan" | "pengembalian", id: number, n: number) {
  const paths: string[] = [];
  for (let i = 0; i < n; i++) {
    const path = `${jenis}/${id}/${randomUUID()}.jpg`;
    const { error } = await db.storage.from("foto-peminjaman").upload(path, JPEG, { contentType: "image/jpeg" });
    if (error) throw new Error(`Upload gagal: ${error.message}`);
    paths.push(path);
  }
  return paths;
}

export async function asetIds(db: Db, kode: string[]) {
  const { data } = await db.from("aset").select("id, kode_aset").in("kode_aset", kode);
  return kode.map((k) => data!.find((d) => d.kode_aset === k)!.id);
}

/** Pulihkan keadaan: hapus peminjaman uji + foto, kembalikan aset demo ke tersedia/baik. */
export async function bersihkan(peminjamanIds: number[], kodeAset: string[]) {
  if (peminjamanIds.length) {
    const { data: ps } = await admin.from("pemasangan").select("id").in("peminjaman_id", peminjamanIds);
    const { data: pk } = await admin.from("pengembalian").select("id").in("peminjaman_id", peminjamanIds);
    const folders = [
      ...(ps ?? []).map((x) => `pemasangan/${x.id}`),
      ...(pk ?? []).map((x) => `pengembalian/${x.id}`),
    ];
    for (const folder of folders) {
      const { data: files } = await admin.storage.from("foto-peminjaman").list(folder);
      if (files?.length) await admin.storage.from("foto-peminjaman").remove(files.map((f) => `${folder}/${f.name}`));
    }
    // Hapus dari yang paling baru (rantai perpanjangan memakai FK restrict).
    const sorted = [...peminjamanIds].sort((a, b) => b - a);
    for (const id of sorted) await admin.from("penggantian_unit").delete().in(
      "detail_peminjaman_id",
      ((await admin.from("detail_peminjaman").select("id").eq("peminjaman_id", id)).data ?? []).map((d) => d.id),
    );
    for (const id of sorted) await admin.from("peminjaman").delete().eq("id", id);
  }
  if (kodeAset.length) {
    await admin.from("aset").update({ status: "tersedia", kondisi: "baik" }).in("kode_aset", kodeAset);
  }
}
