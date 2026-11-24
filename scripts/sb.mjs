// Menjalankan Supabase CLI dengan env dari .env.local (SUPABASE_DB_PASSWORD).
// Pemakaian: node scripts/sb.mjs <argumen supabase...> [--out <file>]
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
let outFile;
if (outIdx !== -1) {
  outFile = args[outIdx + 1];
  args.splice(outIdx, 2);
}

const res = spawnSync("npx", ["supabase", ...args], {
  stdio: ["inherit", outFile ? "pipe" : "inherit", "inherit"],
  shell: process.platform === "win32",
  env: process.env,
  encoding: "utf8",
});

if (outFile && res.status === 0) writeFileSync(outFile, res.stdout);
process.exit(res.status ?? 1);
