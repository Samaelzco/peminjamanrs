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

/** Ubah nilai datetime-local (dianggap WITA) menjadi ISO string UTC. */
export function witaInputToIso(value: string): string {
  return new TZDate(value, TIMEZONE).toISOString();
}
