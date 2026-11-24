import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Ambil detail lengkap satu peminjaman (RLS tetap berlaku). */
export async function getPeminjaman(id: number) {
  const supabase = await createClient();

  const { data: p, error } = await supabase
    .from("peminjaman")
    .select(
      `id, kode_peminjaman, status, nama_peminjam, divisi_peminjam, kontak_peminjam, ruangan, keperluan,
       tgl_peminjaman, tgl_rencana_kembali, created_at, dicatat_oleh, perpanjangan_dari,
       detail_peminjaman ( id, kondisi_keluar, kondisi_masuk, catatan,
         aset ( id, kode_aset, nama_aset, status, kategori_id, kategori ( nama ) ) )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) return null;

  const [{ data: sebelumnya }, { data: sesudahnya }, { data: log }] = await Promise.all([
    p.perpanjangan_dari
      ? supabase.from("peminjaman").select("id, kode_peminjaman, status").eq("id", p.perpanjangan_dari).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("peminjaman").select("id, kode_peminjaman, status").eq("perpanjangan_dari", id).maybeSingle(),
    supabase
      .from("log_peminjaman")
      .select("id, status_lama, status_baru, staff_id, keterangan, created_at")
      .eq("peminjaman_id", id)
      .order("created_at")
      .order("id"),
  ]);

  const staffIds = [...new Set([p.dicatat_oleh, ...(log ?? []).map((l) => l.staff_id)].filter(Boolean))] as string[];
  const { data: staff } = await supabase.rpc("nama_staff", { p_ids: staffIds });
  const namaStaff = new Map((staff ?? []).map((s) => [s.id, s.nama]));

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
    dicatatOleh: namaStaff.get(p.dicatat_oleh) ?? "-",
    sebelumnya: sebelumnya ?? null,
    sesudahnya: sesudahnya ?? null,
    units,
    log: (log ?? []).map((l) => ({ ...l, staffNama: l.staff_id ? namaStaff.get(l.staff_id) ?? null : null })),
  };
}

export type PeminjamanDetail = NonNullable<Awaited<ReturnType<typeof getPeminjaman>>>;
