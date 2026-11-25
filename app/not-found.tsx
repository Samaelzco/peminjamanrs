import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-5xl font-bold text-brand-700">404</p>
      <h1 className="mt-3 text-xl font-bold text-gray-900">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-sm text-gray-500">Alamat yang Anda buka tidak tersedia atau sudah dipindahkan.</p>
      <ButtonLink href="/" className="mt-6">
        Kembali ke Dashboard
      </ButtonLink>
    </main>
  );
}
