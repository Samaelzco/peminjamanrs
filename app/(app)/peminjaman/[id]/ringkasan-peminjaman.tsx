import { Card, CardTitle, InfoGrid, InfoItem } from "@/components/ui";
import { formatWaktu } from "@/lib/datetime";
import type { PeminjamanDetail } from "@/lib/peminjaman";

/** Kartu ringkas data peminjam untuk halaman validasi & perpanjangan. */
export function RingkasanPeminjaman({ p }: { p: PeminjamanDetail }) {
  return (
    <Card>
      <CardTitle className="mb-3.5">Informasi Peminjaman</CardTitle>
      <InfoGrid>
        <InfoItem label="Peminjam">
          {p.namaPeminjam} · {p.divisi}
        </InfoItem>
        <InfoItem label="Kontak">
          <a href={`tel:${p.kontak}`} className="hover:text-brand-700 hover:underline">
            {p.kontak}
          </a>
        </InfoItem>
        <InfoItem label="Ruangan">{p.ruangan}</InfoItem>
        <InfoItem label="Tanggal Keluar">{formatWaktu(p.tglPeminjaman)}</InfoItem>
        <InfoItem label="Tgl Kembali">{formatWaktu(p.tglRencanaKembali)}</InfoItem>
      </InfoGrid>
    </Card>
  );
}
