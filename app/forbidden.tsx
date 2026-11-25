import { ButtonLink } from "@/components/ui";

export default function Forbidden() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-5xl font-bold text-brand-700">403</p>
      <h1 className="mt-3 text-xl font-bold text-gray-900">Akses ditolak</h1>
      <p className="mt-2 text-sm text-gray-500">Anda tidak punya izin untuk membuka halaman ini.</p>
      <ButtonLink href="/" className="mt-6">
        Kembali ke Dashboard
      </ButtonLink>
    </main>
  );
}
