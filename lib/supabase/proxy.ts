import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { permissionUntukRute } from "@/lib/route-permissions";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

const PUBLIC_PATHS = ["/login"];

export async function updateSession(request: NextRequest) {
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
    // Rute yang butuh permission khusus (hanya untuk navigasi halaman; server action memeriksa sendiri).
    const butuh = request.method === "GET" || request.method === "HEAD" ? permissionUntukRute(path) : null;

    // User non-aktif (atau tanpa profil) tidak boleh memakai aplikasi.
    const [{ data: staff }, perms] = await Promise.all([
      supabase.from("staff_it").select("status").eq("id", userId).maybeSingle(),
      butuh ? supabase.rpc("my_permissions") : Promise.resolve(null),
    ]);
    if (!staff || staff.status !== "aktif") {
      await supabase.auth.signOut({ scope: "local" });
      return redirectWithCookies(request, response, "/login", "error=nonaktif");
    }

    if (butuh && !butuh.some((p) => perms?.data?.includes(p))) {
      // Tampilkan halaman "Akses ditolak" dengan status HTTP 403 (URL tetap).
      const url = request.nextUrl.clone();
      url.pathname = "/akses-ditolak";
      url.search = "";
      const res = NextResponse.rewrite(url);
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
