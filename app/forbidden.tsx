import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-5xl font-bold text-cyan-700">403</p>
      <h1 className="mt-3 text-xl font-semibold text-gray-900">Akses ditolak</h1>
      <p className="mt-2 text-sm text-gray-500">Anda tidak punya izin untuk membuka halaman ini.</p>
      <Link href="/" className="mt-6 inline-block text-sm font-medium text-cyan-700 hover:underline">
        Kembali ke beranda
      </Link>
    </div>
  );
}
