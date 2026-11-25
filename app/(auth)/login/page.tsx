import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandMark } from "@/components/brand";
import { InfoNote } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

const ERRORS: Record<string, string> = {
  nonaktif: "Akun Anda non-aktif. Hubungi administrator.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 sm:max-w-md sm:p-8">
        <BrandMark className="mb-5" />
        <h1 className="text-[28px] leading-9 font-bold tracking-[-0.01em] text-gray-900">Masuk</h1>
        <p className="mt-1 mb-6 text-sm text-gray-500">Sistem Peminjaman Barang RSUP Prof. Ngoerah</p>
        <Suspense fallback={<LoginForm />}>
          <LoginFormWithError searchParams={searchParams} />
        </Suspense>
        <InfoNote className="mt-5">
          Akun dibuat oleh Admin. Hubungi bagian administrasi jika belum punya akun.
        </InfoNote>
      </div>
    </main>
  );
}

async function LoginFormWithError({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;
  return <LoginForm initialError={message} />;
}
