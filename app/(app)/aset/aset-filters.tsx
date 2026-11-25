"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { LuSearch } from "react-icons/lu";
import { Card, Field, Input, Select, Spinner } from "@/components/ui";
import { KONDISI, KONDISI_ASET_LIST, STATUS_ASET, STATUS_ASET_LIST } from "@/lib/labels";
import { BATAS } from "@/lib/validation";

type Value = { kategori: string; status: string; kondisi: string; q: string };

export function AsetFilters({
  kategori,
  value,
  aksi,
}: {
  kategori: { id: number; nama: string }[];
  value: Value;
  aksi?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function apply(next: Partial<Value>) {
    const merged = { ...value, ...next };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    startTransition(() => router.replace(`${pathname}${params.size ? `?${params}` : ""}`));
  }

  return (
    <Card className="mb-3">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_auto] xl:items-end">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            apply({ q: String(new FormData(e.currentTarget).get("q") ?? "").trim() });
          }}
        >
          <Field id="cari-aset" label="Cari">
            <div className="relative">
              <Input
                id="cari-aset"
                name="q"
                type="search"
                defaultValue={value.q}
                placeholder="Kode / nama barang... (Enter)"
                maxLength={BATAS.cari}
                className="ps-10"
                enterKeyHint="search"
              />
              <span className="pointer-events-none absolute inset-y-0 start-3 my-auto grid h-5 w-5 text-gray-400" aria-hidden>
                {pending ? <Spinner className="h-5 w-5 text-brand-700" /> : <LuSearch className="h-5 w-5" />}
              </span>
            </div>
          </Field>
        </form>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field id="filter-kategori" label="Kategori">
            <Select id="filter-kategori" value={value.kategori} onChange={(e) => apply({ kategori: e.target.value })}>
              <option value="">Semua</option>
              {kategori.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="filter-status" label="Ketersediaan">
            <Select id="filter-status" value={value.status} onChange={(e) => apply({ status: e.target.value })}>
              <option value="">Semua</option>
              {STATUS_ASET_LIST.map((s) => (
                <option key={s} value={s}>
                  {STATUS_ASET[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="filter-kondisi" label="Kondisi" className="col-span-2 sm:col-span-1">
            <Select id="filter-kondisi" value={value.kondisi} onChange={(e) => apply({ kondisi: e.target.value })}>
              <option value="">Semua</option>
              {KONDISI_ASET_LIST.map((k) => (
                <option key={k} value={k}>
                  {KONDISI[k].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {aksi && <div>{aksi}</div>}
      </div>
    </Card>
  );
}
