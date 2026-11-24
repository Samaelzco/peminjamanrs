"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "flowbite-react";

export function RiwayatPagination({ halaman, totalHalaman }: { halaman: number; totalHalaman: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="mt-4 flex justify-center overflow-x-auto">
      <Pagination
        currentPage={halaman}
        totalPages={totalHalaman}
        previousLabel="Sebelumnya"
        nextLabel="Berikutnya"
        showIcons
        onPageChange={(page) => {
          const params = new URLSearchParams(searchParams.toString());
          if (page > 1) params.set("halaman", String(page));
          else params.delete("halaman");
          router.push(`${pathname}${params.size ? `?${params}` : ""}`);
        }}
      />
    </div>
  );
}
