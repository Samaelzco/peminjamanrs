"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, Select, Spinner, TextInput } from "flowbite-react";
import { HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { KONDISI, KONDISI_ASET_LIST, STATUS_ASET, STATUS_ASET_LIST } from "@/lib/labels";
import { BATAS } from "@/lib/validation";

type Value = { kategori: string; status: string; kondisi: string; q: string };

export function AsetFilters({
  kategori,
  value,
}: {
  kategori: { id: number; nama: string }[];
  value: Value;
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
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 lg:flex-row lg:items-center">
      <form
        className="flex flex-1 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: String(new FormData(e.currentTarget).get("q") ?? "") });
        }}
      >
        <TextInput
          name="q"
          defaultValue={value.q}
          placeholder="Cari kode atau nama aset"
          maxLength={BATAS.cari}
          icon={HiOutlineMagnifyingGlass}
          className="flex-1"
        />
        <Button type="submit" color="light">Cari</Button>
      </form>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex">
        <Select value={value.kategori} onChange={(e) => apply({ kategori: e.target.value })} aria-label="Filter kategori">
          <option value="">Semua kategori</option>
          {kategori.map((k) => (
            <option key={k.id} value={k.id}>{k.nama}</option>
          ))}
        </Select>
        <Select value={value.status} onChange={(e) => apply({ status: e.target.value })} aria-label="Filter status">
          <option value="">Semua status</option>
          {STATUS_ASET_LIST.map((s) => (
            <option key={s} value={s}>{STATUS_ASET[s].label}</option>
          ))}
        </Select>
        <Select value={value.kondisi} onChange={(e) => apply({ kondisi: e.target.value })} aria-label="Filter kondisi">
          <option value="">Semua kondisi</option>
          {KONDISI_ASET_LIST.map((k) => (
            <option key={k} value={k}>{KONDISI[k].label}</option>
          ))}
        </Select>
      </div>
      {pending && <Spinner size="sm" />}
    </div>
  );
}
