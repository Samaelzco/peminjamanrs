"use client";

import { useState, useTransition } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  HelperText,
  Label,
  Select,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  Textarea,
  TextInput,
} from "flowbite-react";
import { HiOutlineArrowsRightLeft, HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import { ambilUnit, buatPeminjaman, opsiGantiUnit, type UnitTersedia } from "../actions";

type FieldErrors = Record<string, string[] | undefined>;

export function PeminjamanForm({
  kategori,
  defaultKeluar,
  defaultKembali,
}: {
  kategori: { id: number; nama: string }[];
  defaultKeluar: string;
  defaultKembali: string;
}) {
  const [units, setUnits] = useState<UnitTersedia[]>([]);
  const [kategoriId, setKategoriId] = useState<string>("");
  const [jumlah, setJumlah] = useState("1");
  const [unitError, setUnitError] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();

  const [ganti, setGanti] = useState<{ id: number; opsi: UnitTersedia[] | null } | null>(null);
  const [, startGanti] = useTransition();

  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const fe = (k: string) => fieldErrors[k]?.[0];

  function tambahUnit() {
    setUnitError(null);
    if (!kategoriId) {
      setUnitError("Pilih kategori terlebih dahulu.");
      return;
    }
    startAdding(async () => {
      const res = await ambilUnit(
        Number(kategoriId),
        Number(jumlah),
        units.map((u) => u.id),
      );
      if (!res.ok) {
        setUnitError(res.fieldErrors?.jumlah?.[0] ?? res.error);
        return;
      }
      setUnits((prev) => [...prev, ...(res.data ?? [])]);
      setJumlah("1");
    });
  }

  function bukaGanti(unit: UnitTersedia) {
    setGanti({ id: unit.id, opsi: null });
    startGanti(async () => {
      const res = await opsiGantiUnit(
        unit.kategori_id,
        units.map((u) => u.id),
      );
      if (!res.ok) {
        setUnitError(res.error);
        setGanti(null);
        return;
      }
      setGanti({ id: unit.id, opsi: res.data ?? [] });
    });
  }

  function pilihGanti(lamaId: number, baruId: number) {
    const baru = ganti?.opsi?.find((o) => o.id === baruId);
    if (!baru) return;
    setUnits((prev) => prev.map((u) => (u.id === lamaId ? baru : u)));
    setGanti(null);
  }

  function simpan(formData: FormData) {
    setSaveError(null);
    setFieldErrors({});
    startSaving(async () => {
      const res = await buatPeminjaman({
        nama_peminjam: String(formData.get("nama_peminjam") ?? ""),
        kontak_peminjam: String(formData.get("kontak_peminjam") ?? ""),
        divisi_peminjam: String(formData.get("divisi_peminjam") ?? ""),
        ruangan: String(formData.get("ruangan") ?? ""),
        keperluan: String(formData.get("keperluan") ?? ""),
        tgl_peminjaman: String(formData.get("tgl_peminjaman") ?? ""),
        tgl_rencana_kembali: String(formData.get("tgl_rencana_kembali") ?? ""),
        aset_ids: units.map((u) => u.id),
      });
      // Kalau berhasil, server action melakukan redirect ke halaman detail.
      if (res && !res.ok) {
        setSaveError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
      }
    });
  }

  // Kelompokkan ringkasan per kategori.
  const ringkasan = Object.entries(
    units.reduce<Record<string, number>>((acc, u) => {
      acc[u.kategori_nama] = (acc[u.kategori_nama] ?? 0) + 1;
      return acc;
    }, {}),
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); simpan(new FormData(e.currentTarget)); }} className="grid gap-6 xl:grid-cols-5">
      <div className="space-y-6 xl:col-span-2">
        <Card>
          <h2 className="text-base font-semibold text-gray-900">Data Peminjam</h2>
          <div className="space-y-4">
            <Field id="nama_peminjam" label="Nama peminjam" error={fe("nama_peminjam")}>
              <TextInput id="nama_peminjam" name="nama_peminjam" required />
            </Field>
            <Field id="kontak_peminjam" label="Nomor kontak" error={fe("kontak_peminjam")}>
              <TextInput id="kontak_peminjam" name="kontak_peminjam" type="tel" inputMode="tel" placeholder="08xxxxxxxxxx" required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="divisi_peminjam" label="Divisi" error={fe("divisi_peminjam")}>
                <TextInput id="divisi_peminjam" name="divisi_peminjam" required />
              </Field>
              <Field id="ruangan" label="Ruangan" error={fe("ruangan")}>
                <TextInput id="ruangan" name="ruangan" required />
              </Field>
            </div>
            <Field id="keperluan" label="Keperluan" error={fe("keperluan")}>
              <Textarea id="keperluan" name="keperluan" rows={3} required />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-gray-900">Jadwal (WITA)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="tgl_peminjaman" label="Tanggal & jam keluar" error={fe("tgl_peminjaman")}>
              <TextInput id="tgl_peminjaman" name="tgl_peminjaman" type="datetime-local" defaultValue={defaultKeluar} required />
            </Field>
            <Field id="tgl_rencana_kembali" label="Rencana kembali" error={fe("tgl_rencana_kembali")}>
              <TextInput id="tgl_rencana_kembali" name="tgl_rencana_kembali" type="datetime-local" defaultValue={defaultKembali} required />
            </Field>
          </div>
        </Card>
      </div>

      <div className="space-y-6 xl:col-span-3">
        <Card>
          <h2 className="text-base font-semibold text-gray-900">Unit yang Dipinjam</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="kategori" className="mb-1.5 block">Kategori</Label>
              <Select id="kategori" value={kategoriId} onChange={(e) => setKategoriId(e.target.value)}>
                <option value="">Pilih kategori</option>
                {kategori.map((k) => (
                  <option key={k.id} value={k.id}>{k.nama}</option>
                ))}
              </Select>
            </div>
            <div className="w-full sm:w-28">
              <Label htmlFor="jumlah" className="mb-1.5 block">Jumlah</Label>
              <TextInput
                id="jumlah"
                type="number"
                min={1}
                max={50}
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    tambahUnit();
                  }
                }}
              />
            </div>
            <Button type="button" onClick={tambahUnit} disabled={adding}>
              {adding ? <Spinner size="sm" className="me-1.5" /> : <HiOutlinePlus className="me-1.5 h-4 w-4" />}
              Tambah Unit
            </Button>
          </div>
          {unitError && (
            <Alert color="failure" onDismiss={() => setUnitError(null)}>
              {unitError}
            </Alert>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeadCell>Kode Unit</TableHeadCell>
                  <TableHeadCell>Nama Barang</TableHeadCell>
                  <TableHeadCell>Kategori</TableHeadCell>
                  <TableHeadCell>Ketersediaan</TableHeadCell>
                  <TableHeadCell>
                    <span className="sr-only">Aksi</span>
                  </TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody className="divide-y">
                {units.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-gray-500">
                      Belum ada unit. Pilih kategori dan jumlah, lalu klik Tambah Unit.
                    </TableCell>
                  </TableRow>
                )}
                {units.map((u) => (
                  <TableRow key={u.id} className="bg-white">
                    <TableCell className="font-mono font-medium text-gray-900">{u.kode_aset}</TableCell>
                    <TableCell>{u.nama_aset}</TableCell>
                    <TableCell>{u.kategori_nama}</TableCell>
                    <TableCell>
                      <Badge color="success" className="w-fit">Tersedia</Badge>
                    </TableCell>
                    <TableCell>
                      {ganti?.id === u.id ? (
                        <div className="flex items-center gap-2">
                          {ganti.opsi === null ? (
                            <Spinner size="sm" />
                          ) : ganti.opsi.length === 0 ? (
                            <span className="text-xs text-gray-500">Tidak ada unit lain yang tersedia.</span>
                          ) : (
                            <Select
                              sizing="sm"
                              defaultValue=""
                              onChange={(e) => pilihGanti(u.id, Number(e.target.value))}
                              aria-label={`Ganti ${u.kode_aset}`}
                            >
                              <option value="" disabled>Pilih unit pengganti</option>
                              {ganti.opsi.map((o) => (
                                <option key={o.id} value={o.id}>{o.kode_aset} — {o.nama_aset}</option>
                              ))}
                            </Select>
                          )}
                          <Button size="xs" color="light" type="button" onClick={() => setGanti(null)}>Batal</Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button size="xs" color="light" type="button" onClick={() => bukaGanti(u)}>
                            <HiOutlineArrowsRightLeft className="me-1 h-4 w-4" />
                            Ganti
                          </Button>
                          <Button
                            size="xs"
                            color="red"
                            type="button"
                            onClick={() => setUnits((prev) => prev.filter((x) => x.id !== u.id))}
                          >
                            <HiOutlineTrash className="me-1 h-4 w-4" />
                            Hapus
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {ringkasan.length > 0 && (
            <p className="text-sm text-gray-600">
              Total {units.length} unit: {ringkasan.map(([k, n]) => `${n} ${k}`).join(", ")}
            </p>
          )}
          {fe("aset_ids") && <HelperText color="failure">{fe("aset_ids")}</HelperText>}
        </Card>

        {saveError && (
          <Alert color="failure" onDismiss={() => setSaveError(null)}>
            {saveError}
          </Alert>
        )}
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={saving || units.length === 0}>
            {saving && <Spinner size="sm" className="me-2" />}
            Simpan Peminjaman
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block">{label}</Label>
      {children}
      {error && <HelperText color="failure">{error}</HelperText>}
    </div>
  );
}
