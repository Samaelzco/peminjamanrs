"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  HelperText,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
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
import { DateTimeField } from "@/components/datetime-field";
import { BATAS, hanyaAngka } from "@/lib/validation";
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
  const [ganti, setGanti] = useState<UnitTersedia | null>(null);

  const [kontak, setKontak] = useState("");
  const [keperluan, setKeperluan] = useState("");

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
    const n = Number(jumlah);
    if (!Number.isInteger(n) || n < 1 || n > BATAS.jumlahUnitMax) {
      setUnitError(`Jumlah harus angka 1–${BATAS.jumlahUnitMax}.`);
      return;
    }
    startAdding(async () => {
      const res = await ambilUnit(Number(kategoriId), n, units.map((u) => u.id));
      if (!res.ok) {
        setUnitError(res.fieldErrors?.jumlah?.[0] ?? res.error);
        return;
      }
      setUnits((prev) => [...prev, ...(res.data ?? [])]);
      setJumlah("1");
    });
  }

  function simpan(formData: FormData) {
    setSaveError(null);
    setFieldErrors({});
    startSaving(async () => {
      const res = await buatPeminjaman({
        nama_peminjam: String(formData.get("nama_peminjam") ?? ""),
        kontak_peminjam: kontak,
        divisi_peminjam: String(formData.get("divisi_peminjam") ?? ""),
        ruangan: String(formData.get("ruangan") ?? ""),
        keperluan,
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

  const ringkasan = Object.entries(
    units.reduce<Record<string, number>>((acc, u) => {
      acc[u.kategori_nama] = (acc[u.kategori_nama] ?? 0) + 1;
      return acc;
    }, {}),
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        simpan(new FormData(e.currentTarget));
      }}
      className="grid gap-6 xl:grid-cols-5"
      noValidate
    >
      <div className="space-y-6 xl:col-span-2">
        <Card>
          <h2 className="text-base font-semibold text-gray-900">Data Peminjam</h2>
          <div className="space-y-4">
            <Field id="nama_peminjam" label="Nama peminjam" error={fe("nama_peminjam")}>
              <TextInput id="nama_peminjam" name="nama_peminjam" maxLength={BATAS.namaOrang} autoComplete="off" required />
            </Field>
            <Field
              id="kontak_peminjam"
              label="Nomor kontak"
              error={fe("kontak_peminjam")}
            >
              <TextInput
                id="kontak_peminjam"
                name="kontak_peminjam"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="08xxxxxxxxxx"
                maxLength={BATAS.kontakMax}
                value={kontak}
                onChange={(e) => setKontak(hanyaAngka(e.target.value).slice(0, BATAS.kontakMax))}
                autoComplete="off"
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="divisi_peminjam" label="Divisi" error={fe("divisi_peminjam")}>
                <TextInput id="divisi_peminjam" name="divisi_peminjam" maxLength={BATAS.divisi} required />
              </Field>
              <Field id="ruangan" label="Ruangan" error={fe("ruangan")}>
                <TextInput id="ruangan" name="ruangan" maxLength={BATAS.ruangan} required />
              </Field>
            </div>
            <Field
              id="keperluan"
              label="Keperluan"
              error={fe("keperluan")}
            >
              <Textarea
                id="keperluan"
                name="keperluan"
                rows={3}
                maxLength={BATAS.keperluan}
                value={keperluan}
                onChange={(e) => setKeperluan(e.target.value)}
                required
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-gray-900">Jadwal (WITA)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="tgl_peminjaman" className="mb-1.5 block">Tanggal & jam keluar</Label>
              <DateTimeField id="tgl_peminjaman" name="tgl_peminjaman" defaultValue={defaultKeluar} required error={fe("tgl_peminjaman")} />
            </div>
            <div>
              <Label htmlFor="tgl_rencana_kembali" className="mb-1.5 block">Rencana kembali</Label>
              <DateTimeField
                id="tgl_rencana_kembali"
                name="tgl_rencana_kembali"
                defaultValue={defaultKembali}
                required
                error={fe("tgl_rencana_kembali")}
              />
            </div>
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
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                value={jumlah}
                onChange={(e) => setJumlah(hanyaAngka(e.target.value).slice(0, 2))}
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
                  <TableHeadCell className="text-right">Aksi</TableHeadCell>
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
                    <TableCell className="font-mono font-medium whitespace-nowrap text-gray-900">{u.kode_aset}</TableCell>
                    <TableCell>{u.nama_aset}</TableCell>
                    <TableCell>{u.kategori_nama}</TableCell>
                    <TableCell>
                      <Badge color="success" className="w-fit">Tersedia</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        <Button size="xs" color="light" type="button" onClick={() => setGanti(u)}>
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

      {ganti && (
        <GantiDraftModal
          unit={ganti}
          kecuali={units.map((u) => u.id)}
          onClose={() => setGanti(null)}
          onPilih={(baru) => {
            setUnits((prev) => prev.map((u) => (u.id === ganti.id ? baru : u)));
            setGanti(null);
          }}
        />
      )}
    </form>
  );
}

/** Modal Ganti: pilih unit lain yang tersedia di kategori yang sama (aturan 6.1). */
function GantiDraftModal({
  unit,
  kecuali,
  onClose,
  onPilih,
}: {
  unit: UnitTersedia;
  kecuali: number[];
  onClose: () => void;
  onPilih: (baru: UnitTersedia) => void;
}) {
  const [opsi, setOpsi] = useState<UnitTersedia[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pilihan, setPilihan] = useState("");
  const [kecualiAwal] = useState(kecuali);

  useEffect(() => {
    let aktif = true;
    opsiGantiUnit(unit.kategori_id, kecualiAwal).then((res) => {
      if (!aktif) return;
      if (res.ok) setOpsi(res.data ?? []);
      else setError(res.error);
    });
    return () => {
      aktif = false;
    };
  }, [unit.kategori_id, kecualiAwal]);

  return (
    <Modal show size="md" onClose={onClose} dismissible>
      <ModalHeader>Ganti Unit {unit.kode_aset}</ModalHeader>
      <ModalBody>
        {error && <Alert color="failure" className="mb-4">{error}</Alert>}
        <Label htmlFor="unit_pengganti" className="mb-1.5 block">Unit pengganti ({unit.kategori_nama})</Label>
        {opsi === null && !error ? (
          <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner size="sm" /> Memuat unit tersedia...</div>
        ) : opsi && opsi.length === 0 ? (
          <p className="text-sm text-gray-500">Tidak ada unit lain yang tersedia di kategori ini.</p>
        ) : (
          <Select
            id="unit_pengganti"
            aria-label={`Ganti ${unit.kode_aset}`}
            value={pilihan}
            onChange={(e) => setPilihan(e.target.value)}
          >
            <option value="" disabled>Pilih unit pengganti</option>
            {(opsi ?? []).map((o) => (
              <option key={o.id} value={o.id}>{o.kode_aset} — {o.nama_aset}</option>
            ))}
          </Select>
        )}
      </ModalBody>
      <ModalFooter className="justify-end">
        <Button color="alternative" onClick={onClose}>Batal</Button>
        <Button
          disabled={!pilihan}
          onClick={() => {
            const baru = opsi?.find((o) => o.id === Number(pilihan));
            if (baru) onPilih(baru);
          }}
        >
          Ganti Unit
        </Button>
      </ModalFooter>
    </Modal>
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
