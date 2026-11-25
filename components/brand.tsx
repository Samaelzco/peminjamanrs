import Image from "next/image";
import { cn } from "@/components/ui";
import logo from "@/public/Logo-RS-New.png";

/** Logo Kemenkes – RS Ngoerah untuk top bar, sidebar, dan halaman masuk. */
export function BrandMark({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src={logo}
      alt="Kemenkes RS Ngoerah"
      priority={priority}
      sizes="120px"
      className={cn("h-8 w-auto", className)}
    />
  );
}
