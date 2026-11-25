"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { TZDate } from "@date-fns/tz";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { LuSearch } from "react-icons/lu";
import { DateTimeField } from "@/components/datetime-field";
import { Button, Card, Field, Input, Select, cn } from "@/components/ui";
import { TIMEZONE } from "@/lib/datetime";
import { STATUS_PEMINJAMAN, STATUS_PEMINJAMAN_LIST } from "@/lib/labels";
import { BATAS } from "@/lib/validation";

/** Rentang satu bulan kalender (WITA): 0 = bulan ini, 1 = bulan lalu. */
function rentangBulan(mundur: number) {
  const bulan = subMonths(TZDate.tz(TIMEZONE), mundur);
  return { dari: format(startOfMonth(bulan), "yyyy-MM-dd"), sampai: format(endOfMonth(bulan), "yyyy-MM-dd") };
}

type Value = { q: string; status: string; dari: string; sampai: string };

export function RiwayatFilters({ value }: { value: Value }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const adaFilter = Object.values(value).some(Boolean);

  function apply(next: Value) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    startTransition(() => router.replace(`${pathname}${params.size ? `?${params}` : ""}`));
  }

  return (
    <Card className="mb-3">
      <form
        key={JSON.stringify(value)}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          apply({
            q: String(fd.get("q") ?? "").trim(),
            status: String(fd.get("status") ?? ""),
            dari: String(fd.get("dari") ?? ""),
            sampai: String(fd.get("sampai") ?? ""),
          });
        }}
      >
        <Field id="q" label="Cari" className="md:col-span-2 xl:col-span-1">
          <div className="relative">
            <Input
              id="q"
              name="q"
              type="search"
              defaultValue={value.q}
              placeholder="Kode / nama peminjam / unit..."
              maxLength={BATAS.cari}
              className="ps-10"
            />
            <LuSearch className="pointer-events-none absolute inset-y-0 start-3 my-auto h-5 w-5 text-gray-400" aria-hidden />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3 md:col-span-2 xl:col-span-2">
          <Field id="dari" label="Keluar dari">
            <DateTimeField id="dari" name="dari" tanggalSaja defaultValue={value.dari} />
          </Field>
          <Field id="sampai" label="Sampai">
            <DateTimeField id="sampai" name="sampai" tanggalSaja defaultValue={value.sampai} />
          </Field>
        </div>
        <Field id="status" label="Status">
          <Select id="status" name="status" defaultValue={value.status}>
            <option value="">Semua status</option>
            {STATUS_PEMINJAMAN_LIST.map((s) => (
              <option key={s} value={s}>
                {STATUS_PEMINJAMAN[s].label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex flex-wrap items-center gap-2 md:col-span-2 xl:col-span-4">
          <span className="text-sm text-gray-500">Periode cepat:</span>
          {[
            { label: "Bulan ini", mundur: 0 },
            { label: "Bulan lalu", mundur: 1 },
          ].map((p) => {
            const r = rentangBulan(p.mundur);
            const aktif = value.dari === r.dari && value.sampai === r.sampai;
            return (
              <button
                key={p.label}
                type="button"
                disabled={pending}
                aria-pressed={aktif}
                onClick={() => apply({ ...value, ...r })}
                className={cn(
                  "min-h-9 rounded-full border px-3.5 text-sm font-medium transition-colors duration-200 disabled:opacity-50",
                  aktif
                    ? "border-brand-700 bg-brand-50 text-brand-800"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
                )}
              >
                {p.label}
              </button>
            );
          })}
          <div className="mt-2 grid w-full grid-cols-2 gap-3 sm:mt-0 sm:ms-auto sm:flex sm:w-auto">
            <Button
              variant="secondary"
              disabled={pending || !adaFilter}
              onClick={() => apply({ q: "", status: "", dari: "", sampai: "" })}
            >
              Reset
            </Button>
            <Button type="submit" loading={pending} className="sm:min-w-32">
              Terapkan
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
