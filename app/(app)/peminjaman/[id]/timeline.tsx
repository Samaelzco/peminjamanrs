import { cn } from "@/components/ui";
import { formatWaktu } from "@/lib/datetime";
import type { TimelineEvent } from "@/lib/peminjaman";

const WARNA: Record<TimelineEvent["jenis"], string> = {
  diajukan: "bg-yellow-500",
  dipinjam: "bg-brand-700",
  terlambat: "bg-red-700",
  dibatalkan: "bg-gray-400",
  selesai: "bg-green-700",
  ganti: "bg-purple-600",
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-gray-500">Belum ada kejadian.</p>;

  return (
    <ol className="space-y-3.5">
      {events.map((e) => (
        <li key={e.key} className="flex gap-3">
          <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", WARNA[e.jenis])} aria-hidden />
          <div className="min-w-0">
            <time className="text-[13px] text-gray-500">{formatWaktu(e.waktu)}</time>
            <p className="text-[15px] leading-5 break-words text-gray-900">{e.judul}</p>
            {e.keterangan && <p className="mt-0.5 text-sm break-words whitespace-pre-line text-gray-600">{e.keterangan}</p>}
            <p className="mt-0.5 text-xs text-gray-400">{e.staffNama ? `oleh ${e.staffNama}` : "oleh sistem"}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
