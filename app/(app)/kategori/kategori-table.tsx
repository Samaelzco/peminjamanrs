"use client";

import { useState } from "react";
import {
  Button,
  HelperText,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
} from "flowbite-react";
import { HiOutlinePencilSquare, HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import { ConfirmModal, ResultAlert, useAction } from "@/components/feedback";
import { BATAS, hanyaHurufKapital } from "@/lib/validation";
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

  return (
    <>
      <ResultAlert result={page.result} onDismiss={page.reset} />

      {canCreate && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setForm({})}>
            <HiOutlinePlus className="me-1.5 h-4 w-4" />
            Tambah Kategori
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell>Nama</TableHeadCell>
              <TableHeadCell>Kode Prefix</TableHeadCell>
              <TableHeadCell>Jumlah Aset</TableHeadCell>
              <TableHeadCell>
                <span className="sr-only">Aksi</span>
              </TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody className="divide-y">
            {kategori.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-500">
                  Belum ada kategori.
                </TableCell>
              </TableRow>
            )}
            {kategori.map((k) => (
              <TableRow key={k.id} className="bg-white">
                <TableCell className="font-medium text-gray-900">{k.nama}</TableCell>
                <TableCell className="font-mono">{k.kodePrefix}</TableCell>
                <TableCell>{k.jumlahAset}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {canUpdate && (
                      <Button size="xs" color="light" onClick={() => setForm({ kategori: k })}>
                        <HiOutlinePencilSquare className="me-1 h-4 w-4" />
                        Edit
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="xs"
                        color="red"
                        disabled={k.jumlahAset > 0}
                        title={k.jumlahAset > 0 ? "Kategori masih memiliki aset" : undefined}
                        onClick={() => setHapus(k)}
                      >
                        <HiOutlineTrash className="me-1 h-4 w-4" />
                        Hapus
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {form && (
        <KategoriFormModal
          key={form.kategori?.id ?? "baru"}
          kategori={form.kategori}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null);
            page.show({ ok: true, message });
          }}
        />
      )}

      <ConfirmModal
        open={!!hapus}
        title="Hapus kategori"
        message={`Kategori "${hapus?.nama}" akan dihapus permanen. Lanjutkan?`}
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

function KategoriFormModal({
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
    <Modal show size="md" onClose={onClose} dismissible>
      <ModalHeader>{kategori ? "Edit Kategori" : "Tambah Kategori"}</ModalHeader>
      <form onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}>
        <ModalBody>
          {action.result && !action.result.ok && <ResultAlert result={action.result} />}
          <div className="space-y-4">
            <div>
              <Label htmlFor="nama" className="mb-1.5 block">Nama kategori</Label>
              <TextInput id="nama" name="nama" maxLength={BATAS.namaKategori} defaultValue={kategori?.nama} required color={err("nama") ? "failure" : undefined} />
              {err("nama") && <HelperText color="failure">{err("nama")}</HelperText>}
            </div>
            <div>
              <Label htmlFor="kode_prefix" className="mb-1.5 block">Kode prefix</Label>
              <TextInput
                id="kode_prefix"
                name="kode_prefix"
                defaultValue={kategori?.kodePrefix}
                placeholder="LPT"
                maxLength={5}
                className="uppercase"
                autoComplete="off"
                onChange={(e) => {
                  e.currentTarget.value = hanyaHurufKapital(e.currentTarget.value);
                }}
                required
                disabled={prefixLocked}
                color={err("kode_prefix") ? "failure" : undefined}
              />
              {err("kode_prefix") && <HelperText color="failure">{err("kode_prefix")}</HelperText>}
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="justify-end">
          <Button color="alternative" onClick={onClose} disabled={action.pending}>Batal</Button>
          <Button type="submit" disabled={action.pending}>
            {action.pending ? "Menyimpan..." : "Simpan"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
