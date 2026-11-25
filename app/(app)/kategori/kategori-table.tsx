"use client";

import { useDeferredValue, useState } from "react";
import { LuPlus, LuSearch } from "react-icons/lu";
import { ConfirmDialog, ResultAlert, useAction } from "@/components/feedback";
import { Sheet, SheetActions } from "@/components/overlay";
import { Button, Card, Field, InfoNote, Input } from "@/components/ui";
import { BATAS, sanitasiPrefix } from "@/lib/validation";
import { createKategori, deleteKategori, updateKategori } from "./actions";

type Kategori = { id: number; nama: string; kodePrefix: string; jumlahAset: number };

export function KategoriTable({
  kategori,
  canCreate,
  canUpdate,
  canDelete,
}: {
  kategori: Kategori[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const page = useAction();
  const [form, setForm] = useState<{ kategori?: Kategori } | null>(null);
  const [hapus, setHapus] = useState<Kategori | null>(null);
  const [q, setQ] = useState("");
  const cari = useDeferredValue(q.trim().toLowerCase());
  const hasil = kategori.filter(
    (k) => !cari || k.nama.toLowerCase().includes(cari) || k.kodePrefix.toLowerCase().includes(cari),
  );

  return (
    <>
      <ResultAlert result={page.result} onDismiss={page.reset} />

      <Card className="lg:max-w-3xl">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field id="cari-kategori" label="Cari">
            <div className="relative">
              <Input
                id="cari-kategori"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nama kategori..."
                className="ps-10"
                maxLength={BATAS.cari}
              />
              <LuSearch className="pointer-events-none absolute inset-y-0 start-3 my-auto h-5 w-5 text-gray-400" aria-hidden />
            </div>
          </Field>
          {canCreate && (
            <Button onClick={() => setForm({})} block className="sm:w-auto">
              <LuPlus className="h-4 w-4" aria-hidden />
              Tambah Kategori
            </Button>
          )}
        </div>

        {hasil.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            {kategori.length === 0 ? "Belum ada kategori." : "Tidak ada kategori yang cocok."}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-200">
            {hasil.map((k) => (
              <li key={k.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] break-words text-gray-900">{k.nama}</p>
                  <p className="text-xs text-gray-500">
                    Prefix <span className="font-mono">{k.kodePrefix}</span> · {k.jumlahAset} unit
                  </p>
                </div>
                {canUpdate && (
                  <Button variant="ghost" size="sm" onClick={() => setForm({ kategori: k })} aria-label={`Edit ${k.nama}`}>
                    Edit
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-800 hover:bg-red-50"
                    disabled={k.jumlahAset > 0}
                    title={k.jumlahAset > 0 ? "Kategori masih memiliki unit" : undefined}
                    onClick={() => setHapus(k)}
                    aria-label={`Hapus ${k.nama}`}
                  >
                    Hapus
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canDelete && <InfoNote className="mt-3">Kategori yang masih punya unit tidak bisa dihapus.</InfoNote>}
      </Card>

      {form && (
        <KategoriSheet
          key={form.kategori?.id ?? "baru"}
          kategori={form.kategori}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null);
            page.show({ ok: true, message });
          }}
        />
      )}

      <ConfirmDialog
        open={!!hapus}
        title="Hapus Kategori?"
        message={
          <>
            Kategori <strong className="text-gray-900">{hapus?.nama}</strong> akan dihapus. Tindakan ini tidak bisa
            dibatalkan. Kategori yang masih punya unit barang tidak bisa dihapus.
          </>
        }
        confirmLabel="Hapus"
        pending={page.pending}
        onClose={() => setHapus(null)}
        onConfirm={() => {
          if (!hapus) return;
          const id = hapus.id;
          page.run(() => deleteKategori(id), () => setHapus(null));
        }}
      />
    </>
  );
}

function KategoriSheet({
  kategori,
  onClose,
  onSaved,
}: {
  kategori?: Kategori;
  onClose: () => void;
  onSaved: (message?: string) => void;
}) {
  const action = useAction();
  const err = action.fieldError;
  const prefixLocked = !!kategori && kategori.jumlahAset > 0;

  function submit(formData: FormData) {
    const values = {
      nama: String(formData.get("nama") ?? ""),
      kode_prefix: String(formData.get("kode_prefix") ?? kategori?.kodePrefix ?? ""),
    };
    action.run(async () => {
      const res = kategori ? await updateKategori(kategori.id, values) : await createKategori(values);
      if (res.ok) onSaved(res.message);
      return res;
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={kategori ? "Edit Kategori" : "Tambah Kategori"}
      dismissible={!action.pending}
      footer={
        <SheetActions>
          <Button variant="secondary" onClick={onClose} disabled={action.pending}>
            Batal
          </Button>
          <Button type="submit" form="form-kategori" loading={action.pending}>
            Simpan
          </Button>
        </SheetActions>
      }
    >
      <form
        id="form-kategori"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        {action.result && !action.result.ok && <ResultAlert result={action.result} className="" />}
        <Field id="nama" label="Nama Kategori" error={err("nama")}>
          <Input
            id="nama"
            name="nama"
            placeholder="Contoh: Proyektor"
            maxLength={BATAS.namaKategori}
            defaultValue={kategori?.nama}
            invalid={!!err("nama")}
            data-autofocus
            required
          />
        </Field>
        <Field
          id="kode_prefix"
          label="Kode Prefix"
          error={err("kode_prefix")}
          hint={prefixLocked ? "Prefix dikunci karena kategori sudah punya unit." : "Dipakai untuk kode barang, contoh TI-LPT-001."}
        >
          <Input
            id="kode_prefix"
            name="kode_prefix"
            defaultValue={kategori?.kodePrefix}
            placeholder="TI-LPT"
            maxLength={BATAS.kodePrefix}
            className="uppercase"
            autoComplete="off"
            onChange={(e) => {
              e.currentTarget.value = sanitasiPrefix(e.currentTarget.value);
            }}
            required
            disabled={prefixLocked}
            invalid={!!err("kode_prefix")}
          />
        </Field>
      </form>
    </Sheet>
  );
}
