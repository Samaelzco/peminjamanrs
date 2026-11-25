"use client";

import { useDeferredValue, useState } from "react";
import { LuPlus, LuSearch } from "react-icons/lu";
import { PeminjamanCard, type PeminjamanRow } from "@/components/peminjaman-table";
import { ButtonLink, Card, CardTitle, EmptyState, Field, Input, Select } from "@/components/ui";
import { STATUS_PEMINJAMAN, type StatusPeminjaman } from "@/lib/labels";

const STATUS_BERJALAN: StatusPeminjaman[] = ["diajukan", "dipinjam", "terlambat"];

export function PeminjamanBerjalan({ rows, bisaBuat }: { rows: PeminjamanRow[]; bisaBuat: boolean }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const cari = useDeferredValue(q.trim().toLowerCase());

  const hasil = rows.filter(
    (r) =>
      (!status || r.status === status) &&
      (!cari ||
        [r.kode, r.namaPeminjam, r.divisi, r.ruangan, ...r.units].some((v) => v.toLowerCase().includes(cari))),
  );

  return (
    <section aria-labelledby="judul-berjalan">
      <Card className="mb-3">
        <CardTitle as="h2">
          <span id="judul-berjalan">Peminjaman Berjalan</span>
        </CardTitle>
        <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-end">
          <Field id="cari-berjalan" label="Cari">
            <div className="relative">
              <Input
                id="cari-berjalan"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Kode / nama peminjam / unit..."
                className="ps-10"
                maxLength={60}
              />
              <LuSearch className="pointer-events-none absolute inset-y-0 start-3 my-auto h-5 w-5 text-gray-400" aria-hidden />
            </div>
          </Field>
          <Field id="status-berjalan" label="Status">
            <Select id="status-berjalan" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Semua status</option>
              {STATUS_BERJALAN.map((s) => (
                <option key={s} value={s}>
                  {STATUS_PEMINJAMAN[s].label}
                </option>
              ))}
            </Select>
          </Field>
          {bisaBuat && (
            <ButtonLink href="/peminjaman/baru" block className="md:w-auto">
              <LuPlus className="h-4 w-4 md:hidden lg:block" aria-hidden />
              Peminjaman Baru
            </ButtonLink>
          )}
        </div>
      </Card>

      <p className="sr-only" aria-live="polite">
        {hasil.length} peminjaman ditampilkan
      </p>
      {hasil.length === 0 ? (
        <EmptyState>
          {rows.length === 0 ? "Tidak ada peminjaman berjalan." : "Tidak ada peminjaman yang cocok dengan pencarian."}
        </EmptyState>
      ) : (
        <ul className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {hasil.map((r) => (
            <PeminjamanCard key={r.id} row={r} />
          ))}
        </ul>
      )}
    </section>
  );
}
