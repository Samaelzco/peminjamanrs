import "server-only";

/** Halaman /debug hanya aktif bila ENABLE_DEBUG_PAGE=true. */
export function debugAktif() {
  return process.env.ENABLE_DEBUG_PAGE === "true";
}
