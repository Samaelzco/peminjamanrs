import { Spinner } from "flowbite-react";

export function LoadingBlock({ label = "Memuat..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-gray-500">
      <Spinner size="md" />
      {label}
    </div>
  );
}
