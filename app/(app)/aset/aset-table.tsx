"use client";

import Link from "next/link";
import { useState } from "react";
import { LuPencil, LuTrash2 } from "react-icons/lu";
import { ConfirmDialog, ResultAlert, useAction } from "@/components/feedback";
import { Sheet, SheetActions } from "@/components/overlay";
import { Button, EmptyState, Field, Input, Pill, Select, Textarea } from "@/components/ui";
import { KONDISI, STATUS_ASET, type KondisiAset, type StatusAset } from "@/lib/labels";
import { BATAS } from "@/lib/validation";
import { createAset, deleteAset, updateAset } from "./actions";

export type AsetRow = {
  id: number;
  kodeAset: string;
  namaAset: string;
  deskripsi: string | null;
  kondisi: KondisiAset;
  status: StatusAset;
  kategoriId: number;
  kategoriNama: string;
};

type Kategori = { id: number; nama: string; kode_prefix: string };

export type AsetForm = { aset?: AsetRow } | null;

export function AsetTable({
  aset,
  kategori,
  canUpdate,
  canDelete,
  form,
  setForm,
}: {
  aset: AsetRow[];
  kategori: Kategori[];
  canUpdate: boolean;
  canDelete: boolean;
  form: AsetForm;
  setForm: (f: AsetForm) => void;
}) {
  const page = useAction();
  const [hapus, setHapus] = useState<AsetRow | null>(null);

  return (
    <>
      <ResultAlert result={page.result} onDismiss={page.reset} />

      <p className="mb-3 text-sm text-gray-500" aria-live="polite">
        {aset.length} barang
      </p>
      {aset.length === 0 ? (
        <EmptyState>Tidak ada barang yang cocok.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {aset.map((a) => (
            <li
              key={a.id}
              className="relative flex flex-col rounded-xl border border-gray-200 bg-white p-4 transition-shadow duration-200 hover:shadow-[0_6px_20px_rgba(15,23,42,.06)]"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/aset/${a.id}`}
                  className="text-[15px] font-bold text-gray-900 after:absolute after:inset-0 after:rounded-xl focus:outline-none focus-visible:after:outline-3 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand-600"
                >
                  {a.kodeAset}
                </Link>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {a.kondisi === "rusak" && <Pill tone={KONDISI.rusak.tone}>Rusak</Pill>}
                  <Pill tone={STATUS_ASET[a.status].tone}>{STATUS_ASET[a.status].label}</Pill>
                </div>
              </div>
              <p className="mt-1 text-[15px] break-words text-gray-900">{a.namaAset}</p>
              <p className="mt-0.5 line-clamp-2 text-sm break-words text-gray-500">
                {a.kategoriNama}
                {a.deskripsi && ` · ${a.deskripsi}`}
              </p>
              {canUpdate && (
                <div className="relative z-10 mt-auto pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setForm({ aset: a })}
                    aria-label={`Edit ${a.kodeAset}`}
                  >
                    <LuPencil className="h-4 w-4" aria-hidden />
                    Edit
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {form && (
        <AsetSheet
          key={form.aset?.id ?? "baru"}
          aset={form.aset}
          kategori={kategori}
          onHapus={
            canDelete && form.aset
              ? () => {
                  setHapus(form.aset!);
                  setForm(null);
                }
              : undefined
          }
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null);
            page.show({ ok: true, message });
          }}
        />
      )}

      <ConfirmDialog
        open={!!hapus}
        title="Hapus Barang?"
        message={
          <>
            Barang <strong className="text-gray-900">{hapus?.kodeAset}</strong> akan dihapus permanen. Barang yang punya
            riwayat peminjaman tidak dapat dihapus.
          </>
        }
        confirmLabel="Hapus"
        pending={page.pending}
        onClose={() => setHapus(null)}
        onConfirm={() => {
          if (!hapus) return;
          const id = hapus.id;
          page.run(() => deleteAset(id), () => setHapus(null));
        }}
      />
    </>
  );
}

function AsetSheet({
  aset,
  kategori,
  onHapus,
  onClose,
  onSaved,
}: {
  aset?: AsetRow;
  kategori: Kategori[];
  onHapus?: () => void;
  onClose: () => void;
  onSaved: (message?: string) => void;
}) {
  const action = useAction();
  const err = action.fieldError;
  const dipinjam = aset?.status === "dipinjam";

  function submit(formData: FormData) {
    const common = {
      nama_aset: String(formData.get("nama_aset") ?? ""),
      deskripsi: String(formData.get("deskripsi") ?? ""),
      kondisi: String(formData.get("kondisi") ?? "") as KondisiAset,
    };
    action.run(async () => {
      const res = aset
        ? await updateAset(aset.id, {
            ...common,
            status: (dipinjam ? "dipinjam" : String(formData.get("status"))) as StatusAset,
          })
        : await createAset({
            ...common,
            kategori_id: String(formData.get("kategori_id") ?? ""),
            status: String(formData.get("status") ?? "tersedia") as "tersedia",
          });
      if (res.ok) onSaved(res.message);
      return res;
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={aset ? `Edit Barang ${aset.kodeAset}` : "Tambah Barang"}
      description="Satu data = satu unit fisik"
      dismissible={!action.pending}
      footer={
        <SheetActions>
          <Button variant="secondary" onClick={onClose} disabled={action.pending}>
            Batal
          </Button>
          <Button type="submit" form="form-aset" loading={action.pending}>
            Simpan
          </Button>
        </SheetActions>
      }
    >
      <form
        id="form-aset"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        {action.result && !action.result.ok && <ResultAlert result={action.result} className="" />}
        <Field id="kategori_id" label="Kategori" required error={err("kategori_id")}>
          {aset ? (
            <Select id="kategori_id" value={aset.kategoriId} disabled aria-describedby="kategori-kunci">
              <option value={aset.kategoriId}>{aset.kategoriNama}</option>
            </Select>
          ) : (
            <Select id="kategori_id" name="kategori_id" defaultValue="" required invalid={!!err("kategori_id")}>
              <option value="" disabled>
                Pilih kategori
              </option>
              {kategori.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </Select>
          )}
          {aset && (
            <p id="kategori-kunci" className="mt-1.5 text-xs text-gray-500">
              Kategori menentukan kode barang, jadi tidak bisa diubah.
            </p>
          )}
        </Field>
        <Field id="nama_aset" label="Nama Barang" required error={err("nama_aset")}>
          <Input
            id="nama_aset"
            name="nama_aset"
            placeholder="Contoh: Proyektor Epson EB-X51"
            maxLength={BATAS.namaAset}
            defaultValue={aset?.namaAset}
            invalid={!!err("nama_aset")}
            required
          />
        </Field>
        <Field id="deskripsi" label="Deskripsi">
          <Textarea
            id="deskripsi"
            name="deskripsi"
            rows={3}
            placeholder="Spesifikasi, kelengkapan, nomor seri"
            maxLength={BATAS.deskripsiAset}
            defaultValue={aset?.deskripsi ?? ""}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="status" label="Status">
            <Select id="status" name="status" defaultValue={aset?.status ?? "tersedia"} disabled={dipinjam}>
              {dipinjam && <option value="dipinjam">Dipinjam</option>}
              <option value="tersedia">Ready</option>
              <option value="dalam_perbaikan">Perbaikan</option>
              <option value="hilang">Hilang</option>
            </Select>
          </Field>
          <Field id="kondisi" label="Kondisi">
            <Select id="kondisi" name="kondisi" defaultValue={aset?.kondisi ?? "baik"}>
              <option value="baik">Baik</option>
              <option value="rusak">Rusak</option>
            </Select>
          </Field>
        </div>
        {onHapus && (
          <Button variant="danger-soft" onClick={onHapus} disabled={action.pending} className="self-start">
            <LuTrash2 className="h-4 w-4" aria-hidden />
            Hapus barang ini
          </Button>
        )}
      </form>
    </Sheet>
  );
}
