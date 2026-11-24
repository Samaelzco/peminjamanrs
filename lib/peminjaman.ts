import "server-only";
import type { StatusPeminjaman } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "foto-peminjaman";
const SIGNED_URL_DETIK = 60 * 60;

export type TimelineEvent = {
  key: string;
  waktu: string;
  judul: string;
  keterangan: string | null;
  staffNama: string | null;
  jenis: StatusPeminjaman | "ganti";
};

const JUDUL_STATUS: Record<StatusPeminjaman, string> = {
  diajukan: "Peminjaman diajukan",
  dipinjam: "Unit dipasang & dipinjam",
  terlambat: "Melewati rencana kembali",
  dibatalkan: "Peminjaman dibatalkan",
  selesai: "Peminjaman selesai",
};

function judulLog(lama: StatusPeminjaman | null, baru: StatusPeminjaman) {
  if (lama === null && baru === "dipinjam") return "Perpanjangan dibuat & langsung dipinjam";
  if (lama === null && baru === "terlambat") return "Peminjaman dicatat (sudah terlambat)";
  if (lama === baru) return "Data peminjaman diperbaiki";
  return JUDUL_STATUS[baru];
}

/** Ambil detail lengkap satu peminjaman (RLS tetap berlaku). */
export async function getPeminjaman(id: number) {
  const supabase = await createClient();

  // Semua query yang tidak saling bergantung dijalankan bersamaan.
  const [{ data: p, error }, { data: sesudahnya }, { data: log }] = await Promise.all([
    supabase
      .from("peminjaman")
      .select(
        `id, kode_peminjaman, status, nama_peminjam, divisi_peminjam, kontak_peminjam, ruangan, keperluan,
         tgl_peminjaman, tgl_rencana_kembali, created_at, dicatat_oleh, perpanjangan_dari,
         detail_peminjaman ( id, kondisi_keluar, kondisi_masuk, catatan,
           aset ( id, kode_aset, nama_aset, status, kategori_id, kategori ( nama ) ),
           penggantian_unit ( id, alasan, staff_id, created_at,
             lama:aset!penggantian_unit_aset_lama_id_fkey ( kode_aset ),
             baru:aset!penggantian_unit_aset_baru_id_fkey ( kode_aset ) ) ),
         pemasangan ( id, staff_id, tgl_pemasangan, foto_pemasangan ( id, path_foto ) ),
         pengembalian ( id, staff_id, tgl_kembali, foto_pengembalian ( id, path_foto ) )`,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("peminjaman").select("id, kode_peminjaman, status").eq("perpanjangan_dari", id).maybeSingle(),
    supabase
      .from("log_peminjaman")
      .select("id, status_lama, status_baru, staff_id, keterangan, created_at")
      .eq("peminjaman_id", id)
      .order("created_at")
      .order("id"),
  ]);
  if (error) throw new Error(error.message);
  if (!p) return null;
  const penggantian = p.detail_peminjaman.flatMap((d) => d.penggantian_unit);
  const pemasangan = p.pemasangan;
  const pengembalian = p.pengembalian;

  const staffIds = [
    ...new Set(
      [
        p.dicatat_oleh,
        ...(log ?? []).map((l) => l.staff_id),
        ...penggantian.map((g) => g.staff_id),
        pemasangan?.staff_id,
        pengembalian?.staff_id,
      ].filter((x): x is string => !!x),
    ),
  ];
  // Putaran kedua (bersamaan): nama staf, signed URL foto (bucket privat), peminjaman sebelumnya.
  const pathPasang = (pemasangan?.foto_pemasangan ?? []).map((f) => f.path_foto);
  const pathKembali = (pengembalian?.foto_pengembalian ?? []).map((f) => f.path_foto);
  const semuaPath = [...pathPasang, ...pathKembali];
  const [{ data: staff }, { data: urls }, { data: sebelumnya }] = await Promise.all([
    supabase.rpc("nama_staff", { p_ids: staffIds }),
    semuaPath.length
      ? supabase.storage.from(BUCKET).createSignedUrls(semuaPath, SIGNED_URL_DETIK)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
    p.perpanjangan_dari
      ? supabase.from("peminjaman").select("id, kode_peminjaman, status").eq("id", p.perpanjangan_dari).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const namaStaff = new Map((staff ?? []).map((s) => [s.id, s.nama]));
  const nama = (sid: string | null | undefined) => (sid ? namaStaff.get(sid) ?? null : null);
  const signed = new Map<string, string>();
  for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  const fotoUrl = (paths: string[]) => paths.map((path) => ({ path, url: signed.get(path) ?? null }));

  const units = [...p.detail_peminjaman]
    .map((d) => ({
      detailId: d.id,
      asetId: d.aset!.id,
      kodeAset: d.aset!.kode_aset,
      namaAset: d.aset!.nama_aset,
      statusAset: d.aset!.status,
      kategoriId: d.aset!.kategori_id,
      kategoriNama: d.aset!.kategori?.nama ?? "-",
      kondisiKeluar: d.kondisi_keluar,
      kondisiMasuk: d.kondisi_masuk,
      catatan: d.catatan,
    }))
    .sort((a, b) => a.kodeAset.length - b.kodeAset.length || a.kodeAset.localeCompare(b.kodeAset));

  const timeline: TimelineEvent[] = [
    ...(log ?? []).map((l) => ({
      key: `log-${l.id}`,
      waktu: l.created_at,
      judul: judulLog(l.status_lama, l.status_baru),
      keterangan: l.keterangan,
      staffNama: nama(l.staff_id),
      jenis: l.status_baru as TimelineEvent["jenis"],
    })),
    ...penggantian.map((g) => ({
      key: `ganti-${g.id}`,
      waktu: g.created_at,
      judul: `Unit ${g.lama?.kode_aset} diganti ${g.baru?.kode_aset}`,
      keterangan: `Alasan: ${g.alasan}`,
      staffNama: nama(g.staff_id),
      jenis: "ganti" as const,
    })),
  ].sort((a, b) => a.waktu.localeCompare(b.waktu));

  return {
    id: p.id,
    kode: p.kode_peminjaman,
    status: p.status,
    namaPeminjam: p.nama_peminjam,
    divisi: p.divisi_peminjam,
    kontak: p.kontak_peminjam,
    ruangan: p.ruangan,
    keperluan: p.keperluan,
    tglPeminjaman: p.tgl_peminjaman,
    tglRencanaKembali: p.tgl_rencana_kembali,
    createdAt: p.created_at,
    dicatatOleh: nama(p.dicatat_oleh) ?? "-",
    sebelumnya: sebelumnya ?? null,
    /** Unit sudah dipasang (ada pemasangan, atau hasil perpanjangan). */
    terpasang: !!pemasangan || p.perpanjangan_dari !== null,
    sesudahnya: sesudahnya ?? null,
    units,
    pemasangan: pemasangan
      ? { tgl: pemasangan.tgl_pemasangan, staffNama: nama(pemasangan.staff_id), foto: fotoUrl(pathPasang) }
      : null,
    pengembalian: pengembalian
      ? { tgl: pengembalian.tgl_kembali, staffNama: nama(pengembalian.staff_id), foto: fotoUrl(pathKembali) }
      : null,
    timeline,
  };
}

export type PeminjamanDetail = NonNullable<Awaited<ReturnType<typeof getPeminjaman>>>;
