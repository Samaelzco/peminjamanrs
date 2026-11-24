// Target rewrite dari proxy.ts untuk halaman tanpa izin.
// Route handler (bukan page) supaya status HTTP 403 benar-benar terkirim:
// status dari proxy ditimpa saat halaman App Router dirender.

const HTML = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Akses ditolak · Peminjaman Perangkat</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#f9fafb;color:#111827;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  main{max-width:28rem;padding:2rem 1rem;text-align:center}
  .kode{font-size:3rem;font-weight:700;color:#0e7490;margin:0}
  h1{font-size:1.25rem;margin:.75rem 0 0}
  p{color:#6b7280;font-size:.875rem;margin:.5rem 0 0}
  a{display:inline-block;margin-top:1.5rem;padding:.625rem 1.25rem;border-radius:.5rem;
    background:#0e7490;color:#fff;text-decoration:none;font-size:.875rem;font-weight:500}
  a:hover{background:#155e75}
</style>
</head>
<body>
<main>
  <p class="kode">403</p>
  <h1>Akses ditolak</h1>
  <p>Anda tidak punya izin untuk membuka halaman ini.</p>
  <a href="/">Kembali ke beranda</a>
</main>
</body>
</html>`;

function respon() {
  return new Response(HTML, {
    status: 403,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export function GET() {
  return respon();
}

export function HEAD() {
  return new Response(null, { status: 403, headers: { "cache-control": "no-store" } });
}
