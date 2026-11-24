import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-5xl font-bold text-cyan-700">404</p>
      <h1 className="mt-3 text-xl font-semibold text-gray-900">Halaman tidak ditemukan</h1>
      <Link href="/" className="mt-6 inline-block text-sm font-medium text-cyan-700 hover:underline">
        Kembali ke beranda
      </Link>
    </div>
  );
}
