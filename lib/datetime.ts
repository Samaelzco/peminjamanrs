import { format } from "date-fns";
import { TZDate } from "@date-fns/tz";

export const TIMEZONE = "Asia/Makassar";

/** Tampilkan waktu dalam WITA, format dd/MM/yyyy HH:mm. */
export function formatWita(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return format(new TZDate(new Date(value), TIMEZONE), "dd/MM/yyyy HH:mm");
}

/** Nilai untuk <input type="datetime-local"> dalam WITA. */
export function toWitaInput(value: string | Date): string {
  return format(new TZDate(new Date(value), TIMEZONE), "yyyy-MM-dd'T'HH:mm");
}

/** Ubah nilai datetime-local (dianggap WITA, UTC+8 tanpa DST) menjadi ISO string UTC. */
export function witaInputToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    throw new Error("Format tanggal tidak valid.");
  }
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return new Date(`${withSeconds}+08:00`).toISOString();
}

/** Jumlah menit sejak waktu tertentu sampai sekarang (minimal 0). */
export function menitSejak(value: string | Date): number {
  return Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
}
