"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { LuCalendarDays, LuDownload, LuSearch } from "react-icons/lu";
import { DateTimeField, lokalKeTampilan } from "@/components/datetime-field";
import { Sheet, SheetActions } from "@/components/overlay";
import { Button, Card, Field, Input, Label, Select, Spinner, buttonClass, cn } from "@/components/ui";
import { STATUS_PEMINJAMAN, STATUS_PEMINJAMAN_LIST } from "@/lib/labels";
import { BATAS } from "@/lib/validation";

type Value = { q: string; status: string; dari: string; sampai: string };

/**
 * Filter riwayat langsung diterapkan (tanpa tombol Terapkan/Reset):
 * pencarian setelah berhenti mengetik, status & tanggal saat diganti.
 */
export function RiwayatFilters({ value, eksporHref }: { value: Value; eksporHref?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(value.q);
  const [status, setStatus] = useState(value.status);
  const terakhir = useRef(value);

  function apply(next: Partial<Value>) {
    const merged = { ...terakhir.current, ...next };
    terakhir.current = merged;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    startTransition(() => router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false }));
  }

  // Pencarian otomatis 400 ms setelah berhenti mengetik.
  useEffect(() => {
    const bersih = q.trim();
    if (bersih === terakhir.current.q) return;
    const t = setTimeout(() => apply({ q: bersih }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const tanggal = (key: "dari" | "sampai") => (lokal: string | null, teks: string) => {
    if (lokal) apply({ [key]: lokal });
    else if (!teks) apply({ [key]: "" });
  };

  return (
    <Card className="mb-3">
      <form
        role="search"
        className={cn(
          "grid grid-cols-2 gap-x-3 gap-y-4",
          eksporHref
            ? "xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end"
            : "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] xl:items-end",
        )}
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: q.trim() });
        }}
      >
        <Field id="q" label="Cari" className="col-span-2 xl:col-span-1">
          <div className="relative">
            <Input
              id="q"
              name="q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={eksporHref ? "Kode / peminjam / unit / barang..." : "Kode / peminjam / barang..."}
              maxLength={BATAS.cari}
              enterKeyHint="search"
              className="pe-10"
            />
            <span className="pointer-events-none absolute inset-y-0 end-3 my-auto grid h-5 w-5 text-gray-400" aria-hidden>
              {pending ? <Spinner className="h-5 w-5 text-brand-700" /> : <LuSearch className="h-5 w-5" />}
            </span>
          </div>
        </Field>

        {eksporHref ? (
          <>
            <Field id="dari" label="Mulai dari">
              <DateTimeField id="dari" name="dari" tanggalSaja defaultValue={value.dari} onChange={tanggal("dari")} />
            </Field>
            <Field id="sampai" label="Sampai dengan">
              <DateTimeField id="sampai" name="sampai" tanggalSaja defaultValue={value.sampai} onChange={tanggal("sampai")} />
            </Field>
          </>
        ) : (
          <Periode value={value} onApply={(dari, sampai) => apply({ dari, sampai })} />
        )}

        <Field id="status" label="Status" className={eksporHref ? "col-span-2 xl:col-span-1" : undefined}>
          <Select
            id="status"
            name="status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              apply({ status: e.target.value });
            }}
          >
            <option value="">Semua</option>
            {STATUS_PEMINJAMAN_LIST.map((s) => (
              <option key={s} value={s}>
                {STATUS_PEMINJAMAN[s].label}
              </option>
            ))}
          </Select>
        </Field>

        {eksporHref && (
          // Tautan biasa (bukan <Link>) karena tujuannya file unduhan dari route handler.
          <a
            href={eksporHref}
            className={buttonClass({ variant: "secondary", block: true, className: "col-span-2 xl:col-span-1 xl:w-auto" })}
          >
            <LuDownload className="h-4 w-4" aria-hidden />
            Export Excel
          </a>
        )}
      </form>
    </Card>
  );
}

/** "01/11 – 30/11/2026" */
function labelPeriode(dari: string, sampai: string) {
  if (!dari && !sampai) return "Semua periode";
  const d = lokalKeTampilan(dari);
  const s = lokalKeTampilan(sampai);
  if (d && s) return d.slice(6) === s.slice(6) ? `${d.slice(0, 5)} – ${s}` : `${d} – ${s}`;
  return d ? `Sejak ${d}` : `Sampai ${s}`;
}

/** Kolom "Periode" ringkas; rentang tanggal diisi lewat sheet. */
function Periode({ value, onApply }: { value: Value; onApply: (dari: string, sampai: string) => void }) {
  const [open, setOpen] = useState(false);
  const [dari, setDari] = useState(value.dari);
  const [sampai, setSampai] = useState(value.sampai);
  const aktif = !!(value.dari || value.sampai);

  return (
    <div>
      <Label htmlFor="periode">Periode</Label>
      <button
        id="periode"
        type="button"
        onClick={() => {
          setDari(value.dari);
          setSampai(value.sampai);
          setOpen(true);
        }}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-gray-400/80 bg-white px-3 text-start text-sm",
          aktif ? "text-gray-900" : "text-gray-500",
        )}
      >
        <span className="truncate">{labelPeriode(value.dari, value.sampai)}</span>
        <LuCalendarDays className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Periode"
        description="Tanggal keluar peminjaman"
        footer={
          <SheetActions>
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
                onApply("", "");
              }}
            >
              Semua periode
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                onApply(dari, sampai);
              }}
            >
              Pakai
            </Button>
          </SheetActions>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field id="periode-dari" label="Mulai dari">
            <DateTimeField
              id="periode-dari"
              name="dari"
              tanggalSaja
              defaultValue={value.dari}
              onChange={(l, t) => setDari(l ?? (t ? dari : ""))}
            />
          </Field>
          <Field id="periode-sampai" label="Sampai dengan">
            <DateTimeField
              id="periode-sampai"
              name="sampai"
              tanggalSaja
              defaultValue={value.sampai}
              onChange={(l, t) => setSampai(l ?? (t ? sampai : ""))}
            />
          </Field>
        </div>
      </Sheet>
    </div>
  );
}
