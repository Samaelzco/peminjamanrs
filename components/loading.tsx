import { Spinner } from "@/components/ui";

export function LoadingBlock({ label = "Memuat..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-gray-500" role="status">
      <Spinner className="h-5 w-5 text-brand-700" />
      {label}
    </div>
  );
}
