import { formatWita } from "@/lib/datetime";
import type { StatusPeminjaman } from "@/lib/labels";

type Log = {
  id: number;
  status_lama: StatusPeminjaman | null;
  status_baru: StatusPeminjaman;
  keterangan: string | null;
  created_at: string;
  staffNama: string | null;
};

const JUDUL: Record<StatusPeminjaman, string> = {
  diajukan: "Peminjaman diajukan",
  dipinjam: "Unit dipasang & dipinjam",
  terlambat: "Melewati rencana kembali",
  dibatalkan: "Peminjaman dibatalkan",
  selesai: "Peminjaman selesai",
};

const WARNA: Record<StatusPeminjaman, string> = {
  diajukan: "bg-yellow-400",
  dipinjam: "bg-cyan-600",
  terlambat: "bg-red-500",
  dibatalkan: "bg-gray-400",
  selesai: "bg-green-500",
};

export function Timeline({ log }: { log: Log[] }) {
  if (log.length === 0) return <p className="text-sm text-gray-500">Belum ada kejadian.</p>;

  return (
    <ol className="relative ms-2 border-s border-gray-200">
      {log.map((l) => (
        <li key={l.id} className="ms-5 pb-5 last:pb-0">
          <span className={`absolute -start-1.5 mt-1.5 h-3 w-3 rounded-full ring-4 ring-white ${WARNA[l.status_baru]}`} />
          <time className="text-xs text-gray-500">{formatWita(l.created_at)}</time>
          <p className="text-sm font-medium text-gray-900">
            {l.status_lama === null && l.status_baru === "dipinjam" ? "Perpanjangan dibuat & langsung dipinjam" : JUDUL[l.status_baru]}
          </p>
          {l.keterangan && <p className="text-sm whitespace-pre-line text-gray-600">{l.keterangan}</p>}
          <p className="text-xs text-gray-400">{l.staffNama ? `oleh ${l.staffNama}` : "oleh sistem"}</p>
        </li>
      ))}
    </ol>
  );
}
