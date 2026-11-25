"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { LuArrowLeftRight, LuBox } from "react-icons/lu";
import { Sheet, SheetActions } from "@/components/overlay";
import { PhotoPicker, type PickedPhoto } from "@/components/photo-picker";
import { Alert, Button, Card, Field, Segmented, Select, Spinner, Textarea } from "@/components/ui";
import { removePhotos, uploadPhotos } from "@/lib/upload";
import { BATAS } from "@/lib/validation";
import { opsiGantiUnit, type UnitTersedia } from "../actions";
import { gantiUnit, reservasiId, simpanPemasangan, simpanPengembalian } from "./kejadian-actions";

export type UnitForm = {
  detailId: number;
  asetId: number;
  kodeAset: string;
  namaAset: string;
  kategoriId: number;
  kategoriNama: string;
  statusAset: string;
  kondisiKeluar?: "baik" | "rusak" | null;
};

/** Pesan ID → unggah foto → simpan lewat RPC. Foto dihapus lagi kalau simpan gagal. */
function useSubmitDenganFoto(jenis: "pemasangan" | "pengembalian", peminjamanId: number) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tahap, setTahap] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(photos: PickedPhoto[], simpan: (id: number, foto: string[]) => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    if (photos.length === 0) {
      setError("Unggah minimal 1 foto.");
      return;
    }
    startTransition(async () => {
      let paths: string[] = [];
      try {
        setTahap("Menyiapkan...");
        const rid = await reservasiId(jenis, peminjamanId);
        if (!rid.ok || rid.data == null) throw new Error(rid.ok ? "Gagal memesan ID." : rid.error);

        setTahap(`Mengunggah foto 0/${photos.length}...`);
        paths = await uploadPhotos(jenis, rid.data, photos.map((p) => p.blob), (n) =>
          setTahap(`Mengunggah foto ${n}/${photos.length}...`),
        );

        setTahap("Menyimpan...");
        const res = await simpan(rid.data, paths);
        if (!res.ok) throw new Error(res.error);

        router.push(`/peminjaman/${peminjamanId}`);
        router.refresh();
      } catch (e) {
        await removePhotos(paths).catch(() => {});
        setError((e as Error).message);
      } finally {
        setTahap(null);
      }
    });
  }

  return { pending, tahap, error, setError, submit };
}


function UnitKepala({ u, keterangan }: { u: UnitForm; keterangan: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gray-200 text-gray-500" aria-hidden>
        <LuBox className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-bold break-words text-gray-900">
          {u.kodeAset} · {u.namaAset}
        </p>
        <p className="text-sm text-gray-500">{keterangan}</p>
      </div>
    </div>
  );
}

function FotoBukti({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section aria-label={judul}>
      <h2 className="mb-2 text-sm font-semibold text-gray-900">{judul}</h2>
      {children}
    </section>
  );
}

function TombolSimpan({ tahap, pending, children }: { tahap: string | null; pending: boolean; children: string }) {
  return (
    <div className="space-y-2 lg:flex lg:items-center lg:justify-end lg:gap-3 lg:space-y-0">
      {tahap && (
        <p className="flex items-center justify-center gap-2 text-sm text-gray-500" aria-live="polite">
          <Spinner className="h-4 w-4" />
          {tahap}
        </p>
      )}
      <Button type="submit" block loading={pending} className="lg:w-auto lg:min-w-64">
        {children}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------
// Pemasangan
// ---------------------------------------------------------------------
export function PemasanganForm({ peminjamanId, units }: { peminjamanId: number; units: UnitForm[] }) {
  const [kondisi, setKondisi] = useState<Record<number, "baik" | "rusak">>({});
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [ganti, setGanti] = useState<UnitForm | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const s = useSubmitDenganFoto("pemasangan", peminjamanId);

  const belumDiisi = units.filter((u) => !kondisi[u.detailId]);
  const semuaAsetId = useMemo(() => units.map((u) => u.asetId), [units]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (belumDiisi.length) {
          s.setError(`Isi hasil tes alat untuk ${belumDiisi.map((u) => u.kodeAset).join(", ")}.`);
          return;
        }
        s.submit(photos, (id, foto) =>
          simpanPemasangan({
            peminjamanId,
            pemasanganId: id,
            units: units.map((u) => ({ detail_id: u.detailId, kondisi_keluar: kondisi[u.detailId] })),
            foto,
          }),
        );
      }}
      className="space-y-3 lg:space-y-4"
    >
      {info && (
        <Alert tone="success" onDismiss={() => setInfo(null)}>
          {info}
        </Alert>
      )}

      <ul className="grid gap-3 md:grid-cols-2 lg:gap-4">
        {units.map((u) => (
          <li key={u.detailId}>
            <Card as="div" className="h-full">
              <UnitKepala u={u} keterangan={`Kategori ${u.kategoriNama}`} />
              {u.statusAset !== "tersedia" && (
                <Alert tone="warning" className="mt-3">
                  Status barang saat ini: {u.statusAset}. Ganti unit ini.
                </Alert>
              )}
              <div className="mt-3">
                <Segmented
                  name={`kondisi-${u.detailId}`}
                  legend="Hasil Tes Alat"
                  value={kondisi[u.detailId]}
                  onChange={(k) => setKondisi((prev) => ({ ...prev, [u.detailId]: k }))}
                  options={[
                    { value: "baik", label: "Baik" },
                    { value: "rusak", label: "Rusak", tone: "amber" },
                  ]}
                  disabled={s.pending}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGanti(u)}
                disabled={s.pending}
                className="-ms-3 mt-2"
              >
                <LuArrowLeftRight className="h-4 w-4" aria-hidden />
                Ganti Unit
              </Button>
            </Card>
          </li>
        ))}
      </ul>

      <FotoBukti judul="Foto Bukti Pemasangan Barang">
        <PhotoPicker photos={photos} onChange={setPhotos} disabled={s.pending} />
      </FotoBukti>

      {s.error && (
        <Alert tone="danger" onDismiss={() => s.setError(null)}>
          {s.error}
        </Alert>
      )}
      <TombolSimpan tahap={s.tahap} pending={s.pending}>
        Konfirmasi Pemasangan
      </TombolSimpan>

      {ganti && (
        <GantiUnitSheet
          unit={ganti}
          semuaAsetId={semuaAsetId}
          onClose={() => setGanti(null)}
          onDone={(msg) => {
            setGanti(null);
            setKondisi((prev) => {
              const next = { ...prev };
              delete next[ganti.detailId];
              return next;
            });
            setInfo(msg);
          }}
        />
      )}
    </form>
  );
}

function GantiUnitSheet({
  unit,
  semuaAsetId,
  onClose,
  onDone,
}: {
  unit: UnitForm;
  semuaAsetId: number[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [opsi, setOpsi] = useState<UnitTersedia[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formId = `ganti-${unit.detailId}`;

  useEffect(() => {
    let aktif = true;
    opsiGantiUnit(unit.kategoriId, semuaAsetId).then((res) => {
      if (!aktif) return;
      if (res.ok) setOpsi(res.data ?? []);
      else setError(res.error);
    });
    return () => {
      aktif = false;
    };
  }, [unit.kategoriId, semuaAsetId]);

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Ganti Unit ${unit.kodeAset}`}
      description={`Pilih unit ${unit.kategoriNama} lain yang tersedia`}
      footer={
        <SheetActions>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Batal
          </Button>
          <Button type="submit" form={formId} loading={pending} disabled={!opsi?.length}>
            Ganti Unit
          </Button>
        </SheetActions>
      }
    >
      <form
        id={formId}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const res = await gantiUnit(unit.detailId, Number(fd.get("aset_baru")), String(fd.get("alasan") ?? ""));
            if (res.ok) onDone(res.message ?? "Unit diganti.");
            else setError(res.error);
          });
        }}
      >
        {error && <Alert tone="danger">{error}</Alert>}
        {opsi === null ? (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Spinner className="h-4 w-4" /> Memuat unit tersedia...
          </p>
        ) : opsi.length === 0 ? (
          <p className="text-sm text-gray-500">Tidak ada unit lain yang tersedia di kategori ini.</p>
        ) : (
          <Field id="aset_baru" label="Unit pengganti">
            <Select id="aset_baru" name="aset_baru" required defaultValue="">
              <option value="" disabled>
                Pilih unit
              </option>
              {opsi.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.kode_aset} — {o.nama_aset}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field id="alasan" label="Alasan">
          <Textarea
            id="alasan"
            name="alasan"
            rows={3}
            required
            maxLength={BATAS.alasan}
            placeholder="Contoh: tidak menyala saat dites"
          />
        </Field>
      </form>
    </Sheet>
  );
}

// ---------------------------------------------------------------------
// Pengembalian
// ---------------------------------------------------------------------
type KondisiMasuk = "baik" | "rusak" | "hilang";

const PILIHAN_MASUK: { value: KondisiMasuk; label: string; tone?: "amber" | "red" }[] = [
  { value: "baik", label: "Baik" },
  { value: "rusak", label: "Rusak", tone: "amber" },
  { value: "hilang", label: "Tidak Ditemukan (Hilang)", tone: "red" },
];

export function PengembalianForm({ peminjamanId, units }: { peminjamanId: number; units: UnitForm[] }) {
  const [kondisi, setKondisi] = useState<Record<number, KondisiMasuk>>({});
  const [catatan, setCatatan] = useState<Record<number, string>>({});
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [cobaSimpan, setCobaSimpan] = useState(false);
  const s = useSubmitDenganFoto("pengembalian", peminjamanId);

  const butuhCatatan = (id: number) => kondisi[id] === "rusak" || kondisi[id] === "hilang";
  const kurang = units.filter(
    (u) => !kondisi[u.detailId] || (butuhCatatan(u.detailId) && !catatan[u.detailId]?.trim()),
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setCobaSimpan(true);
        if (kurang.length) {
          s.setError(
            `Lengkapi kondisi saat dicek (dan keterangan untuk rusak/hilang): ${kurang.map((u) => u.kodeAset).join(", ")}.`,
          );
          return;
        }
        s.submit(photos, (id, foto) =>
          simpanPengembalian({
            peminjamanId,
            pengembalianId: id,
            units: units.map((u) => ({
              detail_id: u.detailId,
              kondisi_masuk: kondisi[u.detailId],
              catatan: butuhCatatan(u.detailId) ? (catatan[u.detailId] ?? "") : "",
            })),
            foto,
          }),
        );
      }}
      className="space-y-3 lg:space-y-4"
    >
      <ul className="grid gap-3 md:grid-cols-2 lg:gap-4">
        {units.map((u) => {
          const wajib = butuhCatatan(u.detailId);
          const kosong = cobaSimpan && wajib && !catatan[u.detailId]?.trim();
          return (
            <li key={u.detailId}>
              <Card as="div" className="h-full">
                <UnitKepala
                  u={u}
                  keterangan={`Kondisi keluar: ${u.kondisiKeluar ? (u.kondisiKeluar === "baik" ? "Baik" : "Rusak") : "—"}`}
                />
                <div className="mt-3">
                  <Segmented
                    name={`masuk-${u.detailId}`}
                    legend="Kondisi Saat Dicek"
                    value={kondisi[u.detailId]}
                    onChange={(k) => setKondisi((prev) => ({ ...prev, [u.detailId]: k }))}
                    options={PILIHAN_MASUK}
                    disabled={s.pending}
                  />
                </div>
                {wajib && (
                  <Field
                    id={`keterangan-${u.detailId}`}
                    label="Keterangan"
                    className="mt-3"
                    error={kosong ? "Keterangan wajib diisi untuk barang rusak/hilang." : undefined}
                  >
                    <Textarea
                      id={`keterangan-${u.detailId}`}
                      rows={3}
                      placeholder="Contoh: barang rusak/hilang"
                      value={catatan[u.detailId] ?? ""}
                      onChange={(e) => setCatatan((prev) => ({ ...prev, [u.detailId]: e.target.value }))}
                      disabled={s.pending}
                      maxLength={BATAS.catatan}
                      invalid={kosong}
                      aria-label={`Keterangan ${u.kodeAset}`}
                    />
                  </Field>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      <FotoBukti judul="Foto Bukti Pengembalian Barang*">
        <PhotoPicker photos={photos} onChange={setPhotos} disabled={s.pending} />
      </FotoBukti>

      {s.error && (
        <Alert tone="danger" onDismiss={() => s.setError(null)}>
          {s.error}
        </Alert>
      )}
      <TombolSimpan tahap={s.tahap} pending={s.pending}>
        Konfirmasi Pengembalian
      </TombolSimpan>
    </form>
  );
}
