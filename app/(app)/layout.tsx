import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { LoadingBlock } from "@/components/loading";
import { NotifBell } from "@/components/notif-bell";
import { requireUser } from "@/lib/auth";
import { formatWita } from "@/lib/datetime";
import { menuFor } from "@/lib/menu";
import { createClient } from "@/lib/supabase/server";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ count: unread }, { data: notif }] = await Promise.all([
    supabase
      .from("notifikasi")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("sudah_dibaca", false),
    supabase
      .from("notifikasi")
      .select("id, pesan, peminjaman_id, sudah_dibaca, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  return (
    <AppShell
      menu={menuFor(user.permissions)}
      user={{ nama: user.nama, email: user.email, roleNama: user.roleNama }}
      headerRight={
        <NotifBell
          unread={unread ?? 0}
          items={(notif ?? []).map((n) => ({
            id: n.id,
            pesan: n.pesan,
            peminjamanId: n.peminjaman_id,
            sudahDibaca: n.sudah_dibaca,
            waktu: formatWita(n.created_at),
          }))}
        />
      }
    >
      {children}
    </AppShell>
  );
}
