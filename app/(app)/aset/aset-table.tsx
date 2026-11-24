"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Badge,
  Button,
  HelperText,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  Textarea,
  TextInput,
} from "flowbite-react";
import { HiOutlinePencilSquare, HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import { ConfirmModal, ResultAlert, useAction } from "@/components/feedback";
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

export function AsetTable({
  aset,
  kategori,
  canCreate,
  canUpdate,
  canDelete,
}: {
  aset: AsetRow[];
  kategori: Kategori[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const page = useAction();
  const [form, setForm] = useState<{ aset?: AsetRow } | null>(null);
  const [hapus, setHapus] = useState<AsetRow | null>(null);

  return (
    <>
      <ResultAlert result={page.result} onDismiss={page.reset} />

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-gray-500">{aset.length} aset</p>
        {canCreate && (
          <Button onClick={() => setForm({})}>
            <HiOutlinePlus className="me-1.5 h-4 w-4" />
            Tambah Aset
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell>Kode</TableHeadCell>
              <TableHeadCell>Nama Aset</TableHeadCell>
              <TableHeadCell>Kategori</TableHeadCell>
              <TableHeadCell>Kondisi</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell>
                <span className="sr-only">Aksi</span>
              </TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody className="divide-y">
            {aset.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500">
                  Tidak ada aset yang cocok.
                </TableCell>
              </TableRow>
            )}
            {aset.map((a) => (
              <TableRow key={a.id} className="bg-white">
                <TableCell className="font-mono font-medium text-gray-900">
                  <Link href={`/aset/${a.id}`} className="text-cyan-700 hover:underline">
                    {a.kodeAset}
                  </Link>
                </TableCell>
                <TableCell>
                  <p className="text-gray-900">{a.namaAset}</p>
                  {a.deskripsi && <p className="line-clamp-1 text-xs text-gray-500">{a.deskripsi}</p>}
                </TableCell>
                <TableCell>{a.kategoriNama}</TableCell>
                <TableCell>
                  <Badge color={KONDISI[a.kondisi].color} className="w-fit">{KONDISI[a.kondisi].label}</Badge>
                </TableCell>
                <TableCell>
                  <Badge color={STATUS_ASET[a.status].color} className="w-fit">{STATUS_ASET[a.status].label}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {canUpdate && (
                      <Button size="xs" color="light" onClick={() => setForm({ aset: a })}>
                        <HiOutlinePencilSquare className="me-1 h-4 w-4" />
                        Edit
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="xs" color="red" onClick={() => setHapus(a)}>
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
        <AsetFormModal
          key={form.aset?.id ?? "baru"}
          aset={form.aset}
          kategori={kategori}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null);
            page.show({ ok: true, message });
          }}
        />
      )}

      <ConfirmModal
        open={!!hapus}
        title="Hapus aset"
        message={`Aset ${hapus?.kodeAset} akan dihapus permanen. Aset yang punya riwayat peminjaman tidak dapat dihapus.`}
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

function AsetFormModal({
  aset,
  kategori,
  onClose,
  onSaved,
}: {
  aset?: AsetRow;
  kategori: Kategori[];
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
    <Modal show size="lg" onClose={onClose} dismissible>
      <ModalHeader>{aset ? `Edit Aset ${aset.kodeAset}` : "Tambah Aset"}</ModalHeader>
      <form onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}>
        <ModalBody>
          {action.result && !action.result.ok && <ResultAlert result={action.result} />}
          <div className="space-y-4">
            <div>
              <Label htmlFor="kategori_id" className="mb-1.5 block">Kategori</Label>
              {aset ? (
                <TextInput id="kategori_id" value={aset.kategoriNama} disabled />
              ) : (
                <Select id="kategori_id" name="kategori_id" defaultValue="" required>
                  <option value="" disabled>Pilih kategori</option>
                  {kategori.map((k) => (
                    <option key={k.id} value={k.id}>{k.nama} ({k.kode_prefix})</option>
                  ))}
                </Select>
              )}
              <HelperText>
                {aset ? "Kategori dan kode aset tidak dapat diubah." : "Kode aset dibuat otomatis, contoh LPT-004."}
              </HelperText>
              {err("kategori_id") && <HelperText color="failure">{err("kategori_id")}</HelperText>}
            </div>
            <div>
              <Label htmlFor="nama_aset" className="mb-1.5 block">Nama aset</Label>
              <TextInput id="nama_aset" name="nama_aset" maxLength={BATAS.namaAset} defaultValue={aset?.namaAset} required color={err("nama_aset") ? "failure" : undefined} />
              {err("nama_aset") && <HelperText color="failure">{err("nama_aset")}</HelperText>}
            </div>
            <div>
              <Label htmlFor="deskripsi" className="mb-1.5 block">Deskripsi (opsional)</Label>
              <Textarea id="deskripsi" name="deskripsi" rows={2} maxLength={BATAS.deskripsiAset} defaultValue={aset?.deskripsi ?? ""} />
              <HelperText className="text-xs text-gray-500">Maksimal {BATAS.deskripsiAset} karakter.</HelperText>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="kondisi" className="mb-1.5 block">Kondisi</Label>
                <Select id="kondisi" name="kondisi" defaultValue={aset?.kondisi ?? "baik"}>
                  <option value="baik">Baik</option>
                  <option value="rusak">Rusak</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="status" className="mb-1.5 block">Status</Label>
                <Select id="status" name="status" defaultValue={aset?.status ?? "tersedia"} disabled={dipinjam}>
                  {dipinjam && <option value="dipinjam">Dipinjam</option>}
                  <option value="tersedia">Tersedia</option>
                  <option value="dalam_perbaikan">Dalam Perbaikan</option>
                  <option value="hilang">Hilang</option>
                </Select>
                {dipinjam && <HelperText>Status dipinjam diatur oleh alur peminjaman.</HelperText>}
              </div>
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
