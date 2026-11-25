import Link from "next/link";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { cn } from "@/components/ui";

/** Nomor halaman yang ditampilkan: 1 … (sekitar halaman aktif) … terakhir. */
function halamanTampil(aktif: number, total: number): (number | "…")[] {
  const set = new Set([1, total, aktif - 1, aktif, aktif + 1].filter((n) => n >= 1 && n <= total));
  const urut = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  urut.forEach((n, i) => {
    if (i > 0 && n - urut[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

export function RiwayatPagination({
  halaman,
  totalHalaman,
  params,
}: {
  halaman: number;
  totalHalaman: number;
  /** Filter aktif (tanpa `halaman`). */
  params: Record<string, string>;
}) {
  const href = (n: number) => {
    const sp = new URLSearchParams(params);
    if (n > 1) sp.set("halaman", String(n));
    return `/riwayat${sp.size ? `?${sp}` : ""}`;
  };
  const kotak = "grid h-11 min-w-11 place-items-center rounded-lg border text-sm font-semibold transition-colors duration-200";

  return (
    <nav aria-label="Halaman riwayat" className="mt-2 flex justify-center">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          {halaman > 1 ? (
            <Link href={href(halaman - 1)} className={cn(kotak, "border-gray-300 bg-white text-gray-700 hover:bg-gray-50")} aria-label="Halaman sebelumnya">
              <LuChevronLeft className="h-5 w-5" />
            </Link>
          ) : (
            <span className={cn(kotak, "border-gray-200 bg-white text-gray-300")} aria-hidden>
              <LuChevronLeft className="h-5 w-5" />
            </span>
          )}
        </li>
        {halamanTampil(halaman, totalHalaman).map((n, i) => (
          <li key={`${n}-${i}`}>
            {n === "…" ? (
              <span className="grid h-11 min-w-8 place-items-center text-sm text-gray-500" aria-hidden>
                …
              </span>
            ) : (
              <Link
                href={href(n)}
                aria-current={n === halaman ? "page" : undefined}
                aria-label={`Halaman ${n}`}
                className={cn(
                  kotak,
                  "px-2",
                  n === halaman
                    ? "border-brand-700 bg-brand-700 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
                )}
              >
                {n}
              </Link>
            )}
          </li>
        ))}
        <li>
          {halaman < totalHalaman ? (
            <Link href={href(halaman + 1)} className={cn(kotak, "border-gray-300 bg-white text-gray-700 hover:bg-gray-50")} aria-label="Halaman berikutnya">
              <LuChevronRight className="h-5 w-5" />
            </Link>
          ) : (
            <span className={cn(kotak, "border-gray-200 bg-white text-gray-300")} aria-hidden>
              <LuChevronRight className="h-5 w-5" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
