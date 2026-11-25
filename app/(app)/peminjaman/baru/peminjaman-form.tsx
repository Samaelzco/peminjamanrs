"use client";

import { useEffect, useState, useTransition } from "react";
import { LuArrowLeftRight, LuPlus } from "react-icons/lu";
import { DateTimeField } from "@/components/datetime-field";
import { Sheet, SheetActions } from "@/components/overlay";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardTitle,
  Field,
  FieldError,
  InfoNote,
  Input,
  Pill,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
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


  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        simpan(new FormData(e.currentTarget));
      }}
      className="grid gap-3 lg:grid-cols-2 lg:items-start lg:gap-4"
      noValidate
    >
      <div className="space-y-3 lg:space-y-4">
        <Card>
          <CardTitle className="mb-3">Data Peminjam</CardTitle>
          <div className="space-y-4">
            <Field id="nama_peminjam" label="Nama Peminjam" error={fe("nama_peminjam")}>
              <Input
                id="nama_peminjam"
                name="nama_peminjam"
                placeholder="Nama lengkap"
                maxLength={BATAS.namaOrang}
                autoComplete="off"
                invalid={!!fe("nama_peminjam")}
                required
              />
            </Field>
            <Field id="kontak_peminjam" label="Nomor Kontak" error={fe("kontak_peminjam")}>
              <Input
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
                invalid={!!fe("kontak_peminjam")}
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Field id="divisi_peminjam" label="Unit Peminjam" error={fe("divisi_peminjam")}>
                <Input
                  id="divisi_peminjam"
                  name="divisi_peminjam"
                  placeholder="Contoh: Unit Radiologi"
                  maxLength={BATAS.divisi}
                  invalid={!!fe("divisi_peminjam")}
                  required
                />
              </Field>
              <Field id="ruangan" label="Ruangan Tempat Peminjaman" error={fe("ruangan")}>
                <Input
                  id="ruangan"
                  name="ruangan"
                  placeholder="Contoh: R. Rapat Lt.2"
                  maxLength={BATAS.ruangan}
                  invalid={!!fe("ruangan")}
                  required
                />
              </Field>
            </div>
            <Field id="keperluan" label="Alasan Peminjaman" error={fe("keperluan")}>
              <Textarea
                id="keperluan"
                name="keperluan"
                placeholder="Jelaskan keperluan peminjaman"
                maxLength={BATAS.keperluan}
                value={keperluan}
                onChange={(e) => setKeperluan(e.target.value)}
                invalid={!!fe("keperluan")}
                required
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle className="mb-3">Jadwal</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="tgl_peminjaman" label="Tanggal Keluar">
              <DateTimeField
                id="tgl_peminjaman"
                name="tgl_peminjaman"
                defaultValue={defaultKeluar}
                required
                error={fe("tgl_peminjaman")}
              />
            </Field>
            <Field id="tgl_rencana_kembali" label="Tanggal Kembali">
              <DateTimeField
                id="tgl_rencana_kembali"
                name="tgl_rencana_kembali"
                defaultValue={defaultKembali}
                required
                error={fe("tgl_rencana_kembali")}
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-gray-500">Waktu dalam WITA, format 24 jam.</p>
        </Card>
      </div>

      <div className="space-y-3 lg:sticky lg:top-20 lg:space-y-4">
        <Card>
          <CardTitle className="mb-3">Barang yang Dipinjam</CardTitle>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <Field id="kategori" label="Kategori">
              <Select id="kategori" value={kategoriId} onChange={(e) => setKategoriId(e.target.value)}>
                <option value="">Pilih kategori</option>
                {kategori.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="jumlah" label="Jumlah">
              <Input
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
            </Field>
          </div>
          <Button variant="secondary" block className="mt-4" onClick={tambahUnit} loading={adding}>
            {!adding && <LuPlus className="h-4 w-4" aria-hidden />}
            Tambah Unit
          </Button>
          {unitError && (
            <Alert tone="danger" onDismiss={() => setUnitError(null)} className="mt-3">
              {unitError}
            </Alert>
          )}

          {units.length > 0 && (
            <ul className="mt-4 space-y-3" aria-label="Unit dipilih">
              {units.map((u) => (
                <li key={u.id} data-unit-draft className="rounded-lg border border-gray-200 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p data-kode-unit className="font-bold text-gray-900">
                        {u.kode_aset}
                      </p>
                      <p className="mt-0.5 text-[15px] break-words text-gray-900">{u.nama_aset}</p>
                      <p className="text-sm text-gray-500">{u.kategori_nama}</p>
                    </div>
                    <Pill tone="green">Ready</Pill>
                  </div>
                  <div className="mt-2 flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setGanti(u)}>
                      <LuArrowLeftRight className="h-4 w-4" aria-hidden />
                      Ganti
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-800 hover:bg-red-50"
                      onClick={() => setUnits((prev) => prev.filter((x) => x.id !== u.id))}
                    >
                      Hapus
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <InfoNote className="mt-4">
            {units.length === 0
              ? "Belum ada unit. Pilih kategori dan jumlah, lalu tekan Tambah Unit. Sistem mengambil unit tersedia dengan kode terkecil."
              : `${units.length} unit dipilih.`}
          </InfoNote>
          <FieldError>{fe("aset_ids")}</FieldError>
        </Card>

        {saveError && (
          <Alert tone="danger" onDismiss={() => setSaveError(null)}>
            {saveError}
          </Alert>
        )}
        <div className="grid grid-cols-2 gap-3">
          <ButtonLink href="/" variant="secondary">
            Batal
          </ButtonLink>
          <Button type="submit" loading={saving} disabled={units.length === 0}>
            Simpan
          </Button>
        </div>
      </div>

      {ganti && (
        <GantiDraftSheet
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

/** Ganti: pilih unit lain yang tersedia di kategori yang sama (aturan 6.1). */
function GantiDraftSheet({
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
    <Sheet
      open
      onClose={onClose}
      title={`Ganti Unit ${unit.kode_aset}`}
      description={`Pilih unit ${unit.kategori_nama} lain yang tersedia`}
      footer={
        <SheetActions>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button
            disabled={!pilihan}
            onClick={() => {
              const baru = opsi?.find((o) => o.id === Number(pilihan));
              if (baru) onPilih(baru);
            }}
          >
            Ganti Unit
          </Button>
        </SheetActions>
      }
    >
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}
      {opsi === null && !error ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner className="h-4 w-4" /> Memuat unit tersedia...
        </p>
      ) : opsi && opsi.length === 0 ? (
        <p className="text-sm text-gray-500">Tidak ada unit lain yang tersedia di kategori ini.</p>
      ) : (
        <Field id="unit_pengganti" label={`Unit pengganti (${unit.kategori_nama})`}>
          <Select
            id="unit_pengganti"
            aria-label={`Ganti ${unit.kode_aset}`}
            value={pilihan}
            onChange={(e) => setPilihan(e.target.value)}
          >
            <option value="" disabled>
              Pilih unit pengganti
            </option>
            {(opsi ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.kode_aset} — {o.nama_aset}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </Sheet>
  );
}
