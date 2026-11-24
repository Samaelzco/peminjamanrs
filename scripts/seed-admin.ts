import { adminClient, ensureAccount, requireEnv } from "./lib/seed-utils";

async function main() {
  await ensureAccount(adminClient(), {
    email: requireEnv("SEED_ADMIN_EMAIL"),
    password: requireEnv("SEED_ADMIN_PASSWORD"),
    nama: requireEnv("SEED_ADMIN_NAMA"),
    roleNama: "Administrasi",
  });
}

main().catch((err) => {
  console.error("Seed admin gagal:", err.message ?? err);
  process.exit(1);
});
