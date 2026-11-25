import { redirect } from "next/navigation";

/** Daftar role kini menjadi tab di halaman Kelola Akun. */
export default function RolePage() {
  redirect("/akun?tab=role");
}
