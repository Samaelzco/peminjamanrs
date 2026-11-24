"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, Label, Select, Spinner, TextInput } from "flowbite-react";
import { HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { STATUS_PEMINJAMAN, STATUS_PEMINJAMAN_LIST } from "@/lib/labels";

type Value = { q: string; status: string; dari: string; sampai: string };

export function RiwayatFilters({ value }: { value: Value }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function apply(next: Value) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    startTransition(() => router.replace(`${pathname}${params.size ? `?${params}` : ""}`));
  }

  return (
    <form
      key={JSON.stringify(value)}
      className="mb-4 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]"
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
      <div>
        <Label htmlFor="q" className="mb-1.5 block">Cari</Label>
        <TextInput
          id="q"
          name="q"
          defaultValue={value.q}
          placeholder="Kode, nama peminjam, divisi, kode aset"
          icon={HiOutlineMagnifyingGlass}
        />
      </div>
      <div>
        <Label htmlFor="status" className="mb-1.5 block">Status</Label>
        <Select id="status" name="status" defaultValue={value.status}>
          <option value="">Semua status</option>
          {STATUS_PEMINJAMAN_LIST.map((s) => (
            <option key={s} value={s}>{STATUS_PEMINJAMAN[s].label}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="dari" className="mb-1.5 block">Tanggal keluar dari</Label>
        <TextInput id="dari" name="dari" type="date" defaultValue={value.dari} />
      </div>
      <div>
        <Label htmlFor="sampai" className="mb-1.5 block">Sampai</Label>
        <TextInput id="sampai" name="sampai" type="date" defaultValue={value.sampai} />
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner size="sm" /> : "Terapkan"}
        </Button>
        <Button
          type="button"
          color="light"
          disabled={pending}
          onClick={() => apply({ q: "", status: "", dari: "", sampai: "" })}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
