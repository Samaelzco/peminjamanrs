import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { LoadingBlock } from "@/components/loading";
import { requireUser } from "@/lib/auth";
import { menuFor } from "@/lib/menu";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell
      menu={menuFor(user.permissions)}
      user={{ nama: user.nama, email: user.email, roleNama: user.roleNama }}
    >
      {children}
    </AppShell>
  );
}
