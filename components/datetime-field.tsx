"use client";

import { useRef, useState } from "react";
import { LuCalendarDays } from "react-icons/lu";
import { FieldError, Input } from "@/components/ui";

/**
 * Input tanggal (& jam) WITA dengan format tampilan tetap dd/MM/yyyy HH:mm (24 jam),
 * tidak bergantung pada locale browser. Nilai yang dikirim lewat form (hidden input `name`):
 *   - mode tanggal+jam: yyyy-MM-ddTHH:mm (WITA)
 *   - mode tanggalSaja: yyyy-MM-dd
 * atau kosong bila belum valid.
 */

/** yyyy-MM-dd[THH:mm] → dd/MM/yyyy[ HH:mm] */
export function lokalKeTampilan(v: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(v);
  if (!m) return "";
  const tgl = `${m[3]}/${m[2]}/${m[1]}`;
  return m[4] ? `${tgl} ${m[4]}:${m[5]}` : tgl;
}

/** dd/MM/yyyy[ HH:mm] → yyyy-MM-dd[THH:mm], atau null bila tidak valid. */
export function tampilanKeLokal(v: string, tanggalSaja = false): string | null {
  const m = (tanggalSaja ? /^(\d{2})\/(\d{2})\/(\d{4})$/ : /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/).exec(v);
  if (!m) return null;
  const [, dd, mm, yyyy, hh = "00", mi = "00"] = m;
  const d = Number(dd), bln = Number(mm), th = Number(yyyy), j = Number(hh), mnt = Number(mi);
  if (bln < 1 || bln > 12 || j > 23 || mnt > 59 || th < 2000 || th > 2100) return null;
  const hariDalamBulan = new Date(Date.UTC(th, bln, 0)).getUTCDate();
  if (d < 1 || d > hariDalamBulan) return null;
  return tanggalSaja ? `${yyyy}-${mm}-${dd}` : `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

/** Sisipkan "/", " " dan ":" otomatis saat mengetik angka. */
function masker(raw: string, tanggalSaja: boolean) {
  const a = raw.replace(/\D+/g, "").slice(0, tanggalSaja ? 8 : 12);
  let out = a.slice(0, 2);
  if (a.length > 2) out += "/" + a.slice(2, 4);
  if (a.length > 4) out += "/" + a.slice(4, 8);
  if (a.length > 8) out += " " + a.slice(8, 10);
  if (a.length > 10) out += ":" + a.slice(10, 12);
  return out;
}

export function DateTimeField({
  id,
  name,
  defaultValue,
  required,
  error,
  tanggalSaja = false,
  onChange,
}: {
  id: string;
  name: string;
  /** yyyy-MM-ddTHH:mm (atau yyyy-MM-dd untuk tanggalSaja), WITA */
  defaultValue?: string;
  required?: boolean;
  error?: string;
  tanggalSaja?: boolean;
  /** `teks` = isi tampilan; kosong berarti field dikosongkan. */
  onChange?: (lokal: string | null, teks: string) => void;
}) {
  const [teks, setTeks] = useState(defaultValue ? lokalKeTampilan(defaultValue) : "");
  const [disentuh, setDisentuh] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const lokal = tampilanKeLokal(teks, tanggalSaja);
  const format = tanggalSaja ? "dd/mm/yyyy" : "dd/mm/yyyy jj:mm";
  const errorLokal = disentuh && teks && !lokal ? `Tidak valid. Format: ${format}${tanggalSaja ? "" : " (24 jam)"}.` : null;

  function set(v: string) {
    setTeks(v);
    onChange?.(tampilanKeLokal(v, tanggalSaja), v);
  }

  return (
    <div>
      <div className="relative">
        <Input
          id={id}
          value={teks}
          onChange={(e) => set(masker(e.target.value, tanggalSaja))}
          onBlur={() => setDisentuh(true)}
          inputMode="numeric"
          placeholder={format}
          maxLength={tanggalSaja ? 10 : 16}
          autoComplete="off"
          required={required}
          invalid={!!(error || errorLokal)}
          className="pe-12"
        />
        <button
          type="button"
          onClick={() => {
            const el = picker.current;
            if (!el) return;
            el.value = lokal ?? "";
            try {
              el.showPicker();
            } catch {
              el.focus();
            }
          }}
          className="absolute inset-y-0 end-0 grid w-11 place-items-center rounded-e-lg text-gray-500 hover:text-brand-700"
          aria-label="Pilih dari kalender"
        >
          <LuCalendarDays className="h-5 w-5" />
        </button>
        {/* Picker bawaan browser hanya untuk memilih; tampilan tetap memakai format di atas. */}
        <input
          ref={picker}
          type={tanggalSaja ? "date" : "datetime-local"}
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute right-0 bottom-0 h-0 w-0 opacity-0"
          onChange={(e) => {
            if (e.target.value) {
              set(lokalKeTampilan(e.target.value));
              setDisentuh(true);
            }
          }}
        />
      </div>
      <input type="hidden" name={name} value={lokal ?? ""} />
      <FieldError id={`${id}-error`}>{error ?? errorLokal}</FieldError>
    </div>
  );
}
