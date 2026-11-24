import { formatWita } from "@/lib/datetime";
import type { TimelineEvent } from "@/lib/peminjaman";

const WARNA: Record<TimelineEvent["jenis"], string> = {
  diajukan: "bg-yellow-400",
  dipinjam: "bg-cyan-600",
  terlambat: "bg-red-500",
  dibatalkan: "bg-gray-400",
  selesai: "bg-green-500",
  ganti: "bg-purple-500",
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-gray-500">Belum ada kejadian.</p>;

  return (
    <ol className="relative ms-2 border-s border-gray-200">
      {events.map((e) => (
        <li key={e.key} className="ms-5 pb-5 last:pb-0">
          <span className={`absolute -start-1.5 mt-1.5 h-3 w-3 rounded-full ring-4 ring-white ${WARNA[e.jenis]}`} />
          <time className="text-xs text-gray-500">{formatWita(e.waktu)}</time>
          <p className="text-sm font-medium text-gray-900">{e.judul}</p>
          {e.keterangan && <p className="text-sm whitespace-pre-line text-gray-600">{e.keterangan}</p>}
          <p className="text-xs text-gray-400">{e.staffNama ? `oleh ${e.staffNama}` : "oleh sistem"}</p>
        </li>
      ))}
    </ol>
  );
}
