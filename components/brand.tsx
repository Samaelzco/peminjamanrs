import { cn } from "@/components/ui";

/**
 * Penanda instansi di top bar / sidebar.
 * Catatan: wireframe memakai logo resmi Kemenkes – RS Ngoerah. Bila file logonya sudah ada,
 * taruh di /public dan ganti isi komponen ini dengan <Image src="/logo-..." width={78} height={32} />.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} aria-label="Kemenkes RS Ngoerah">
      <span className="grid grid-cols-2 gap-[2px]" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-[3px] bg-brand-400" />
        <span className="h-2.5 w-2.5 rounded-[3px] bg-lime-500" />
        <span className="h-2.5 w-2.5 rounded-[3px] bg-yellow-400" />
        <span className="h-2.5 w-2.5 rounded-[3px] bg-brand-600" />
      </span>
      <span className="flex flex-col leading-none" aria-hidden>
        <span className="text-[11px] font-bold tracking-tight text-brand-500">Kemenkes</span>
        <span className="mt-0.5 text-[8.5px] font-semibold text-brand-800">RS Ngoerah</span>
      </span>
    </span>
  );
}
