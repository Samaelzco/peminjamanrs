import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { AKSES_HEADER, encodeAkses } from "@/lib/akses-header";
import type { Permission } from "@/lib/permissions";
import { permissionUntukRute } from "@/lib/route-permissions";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

const PUBLIC_PATHS = ["/login"];

export async function updateSession(request: NextRequest) {
  // Jangan pernah meneruskan header akses kiriman klien.
  request.headers.delete(AKSES_HEADER);
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!userId && !isPublic) {
    return redirectWithCookies(request, response, "/login");
  }

  if (userId) {
    // Status, profil, dan permission dibaca sekali di sini lalu diteruskan ke render (lib/auth.ts).
    const [{ data: staff }, { data: perms }] = await Promise.all([
      supabase.from("staff_it").select("id, nama, email, status, role_id, roles(nama)").eq("id", userId).maybeSingle(),
      supabase.rpc("my_permissions"),
    ]);

    // User non-aktif (atau tanpa profil) tidak boleh memakai aplikasi.
    if (!staff || staff.status !== "aktif") {
      await supabase.auth.signOut({ scope: "local" });
      return redirectWithCookies(request, response, "/login", "error=nonaktif");
    }

    // Rute yang butuh permission khusus (hanya untuk navigasi halaman; server action memeriksa sendiri).
    const butuh = request.method === "GET" || request.method === "HEAD" ? permissionUntukRute(path) : null;
    if (butuh && !butuh.some((p) => perms?.includes(p))) {
      // Tampilkan halaman "Akses ditolak" dengan status HTTP 403 (URL tetap).
      const url = request.nextUrl.clone();
      url.pathname = "/akses-ditolak";
      url.search = "";
      const res = NextResponse.rewrite(url);
      response.cookies.getAll().forEach((c) => res.cookies.set(c));
      return res;
    }

    if (!isPublic) {
      const headers = new Headers(request.headers);
      headers.set(
        AKSES_HEADER,
        encodeAkses({
          id: staff.id,
          nama: staff.nama,
          email: staff.email,
          roleId: staff.role_id,
          roleNama: staff.roles?.nama ?? "-",
          permissions: (perms ?? []) as Permission[],
        }),
      );
      const res = NextResponse.next({ request: { headers } });
      response.headers.forEach((value, key) => {
        if (key !== "set-cookie" && !key.startsWith("x-middleware-")) res.headers.set(key, value);
      });
      response.cookies.getAll().forEach((c) => res.cookies.set(c));
      return res;
    }
  }

  if (userId && isPublic) {
    return redirectWithCookies(request, response, "/");
  }
  return response;
}

function redirectWithCookies(
  request: NextRequest,
  from: NextResponse,
  to: string,
  search = "",
) {
  const url = request.nextUrl.clone();
  url.pathname = to;
  url.search = search;
  const res = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}
