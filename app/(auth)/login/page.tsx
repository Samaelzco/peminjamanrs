import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "flowbite-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Login" };

const ERRORS: Record<string, string> = {
  nonaktif: "Akun Anda non-aktif. Hubungi administrator.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <div className="mb-2 text-center">
          <p className="text-sm font-medium text-cyan-700">RSUP Prof. Ngoerah</p>
          <h1 className="text-2xl font-bold text-gray-900">Sistem Peminjaman Perangkat</h1>
          <p className="mt-1 text-sm text-gray-500">Masuk dengan akun yang diberikan administrator.</p>
        </div>
        <Suspense fallback={<LoginForm />}>
          <LoginFormWithError searchParams={searchParams} />
        </Suspense>
      </Card>
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
