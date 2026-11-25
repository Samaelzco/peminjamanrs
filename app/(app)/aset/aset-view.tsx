"use client";

import { useState } from "react";
import { LuPlus } from "react-icons/lu";
import { Button } from "@/components/ui";
import { AsetFilters } from "./aset-filters";
import { AsetTable, type AsetForm, type AsetRow } from "./aset-table";

type Kategori = { id: number; nama: string; kode_prefix: string };

export function AsetView({
  aset,
  kategori,
  filter,
  canCreate,
  canUpdate,
  canDelete,
}: {
  aset: AsetRow[];
  kategori: Kategori[];
  filter: { kategori: string; status: string; kondisi: string; q: string };
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const [form, setForm] = useState<AsetForm>(null);

  return (
    <>
      <AsetFilters
        kategori={kategori}
        value={filter}
        aksi={
          canCreate ? (
            <Button block className="xl:w-auto" onClick={() => setForm({})}>
              <LuPlus className="h-4 w-4" aria-hidden />
              Tambah Barang
            </Button>
          ) : undefined
        }
      />
      <AsetTable
        aset={aset}
        kategori={kategori}
        canUpdate={canUpdate}
        canDelete={canDelete}
        form={form}
        setForm={setForm}
      />
    </>
  );
}
