"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Alert,
  Button,
  Card,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Radio,
  Select,
  Spinner,
  Textarea,
} from "flowbite-react";
import { HiOutlineArrowsRightLeft } from "react-icons/hi2";
import { PhotoPicker, type PickedPhoto } from "@/components/photo-picker";
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
          s.setError(`Isi kondisi keluar untuk ${belumDiisi.map((u) => u.kodeAset).join(", ")}.`);
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
      className="space-y-6"
    >
      {info && <Alert color="success" onDismiss={() => setInfo(null)}>{info}</Alert>}

      <Card>
        <h2 className="text-base font-semibold text-gray-900">Kondisi Keluar per Unit</h2>
        <ul className="divide-y divide-gray-100">
          {units.map((u) => (
            <li key={u.detailId} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono font-semibold text-gray-900">{u.kodeAset}</p>
                <p className="text-sm text-gray-500">{u.namaAset} · {u.kategoriNama}</p>
                {u.statusAset !== "tersedia" && (
                  <p className="text-xs text-red-600">Status aset saat ini: {u.statusAset}. Ganti unit ini.</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <fieldset className="flex gap-4" aria-label={`Kondisi keluar ${u.kodeAset}`}>
                  {(["baik", "rusak"] as const).map((k) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <Radio
                        name={`kondisi-${u.detailId}`}
                        value={k}
                        checked={kondisi[u.detailId] === k}
                        onChange={() => setKondisi((prev) => ({ ...prev, [u.detailId]: k }))}
                        disabled={s.pending}
                      />
                      {k === "baik" ? "Baik" : "Rusak"}
                    </label>
                  ))}
                </fieldset>
                <Button size="xs" color="light" type="button" onClick={() => setGanti(u)} disabled={s.pending}>
                  <HiOutlineArrowsRightLeft className="me-1 h-4 w-4" />
                  Ganti Unit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-gray-900">Foto Pemasangan</h2>
        <PhotoPicker photos={photos} onChange={setPhotos} disabled={s.pending} />
      </Card>

      {s.error && <Alert color="failure" onDismiss={() => s.setError(null)}>{s.error}</Alert>}
      <div className="flex items-center justify-end gap-3">
        {s.tahap && <span className="flex items-center gap-2 text-sm text-gray-500"><Spinner size="sm" />{s.tahap}</span>}
        <Button type="submit" size="lg" disabled={s.pending}>Simpan Pemasangan</Button>
      </div>

      {ganti && (
        <GantiUnitModal
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

function GantiUnitModal({
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
    <Modal show size="md" onClose={onClose} dismissible>
      <ModalHeader>Ganti Unit {unit.kodeAset}</ModalHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const res = await gantiUnit(unit.detailId, Number(fd.get("aset_baru")), String(fd.get("alasan") ?? ""));
            if (res.ok) onDone(res.message ?? "Unit diganti.");
            else setError(res.error);
          });
        }}
      >
        <ModalBody>
          {error && <Alert color="failure" className="mb-4">{error}</Alert>}
          <div className="space-y-4">
            <div>
              <Label htmlFor="aset_baru" className="mb-1.5 block">Unit pengganti ({unit.kategoriNama})</Label>
              {opsi === null ? (
                <Spinner size="sm" />
              ) : opsi.length === 0 ? (
                <p className="text-sm text-gray-500">Tidak ada unit lain yang tersedia di kategori ini.</p>
              ) : (
                <Select id="aset_baru" name="aset_baru" required defaultValue="">
                  <option value="" disabled>Pilih unit</option>
                  {opsi.map((o) => (
                    <option key={o.id} value={o.id}>{o.kode_aset} — {o.nama_aset}</option>
                  ))}
                </Select>
              )}
            </div>
            <div>
              <Label htmlFor="alasan" className="mb-1.5 block">Alasan</Label>
              <Textarea id="alasan" name="alasan" rows={2} required maxLength={BATAS.alasan} placeholder="Contoh: tidak menyala saat dites" />
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="justify-end">
          <Button color="alternative" onClick={onClose} disabled={pending}>Batal</Button>
          <Button type="submit" disabled={pending || !opsi?.length}>
            {pending ? "Mengganti..." : "Ganti Unit"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Pengembalian
// ---------------------------------------------------------------------
type KondisiMasuk = "baik" | "rusak" | "hilang";

export function PengembalianForm({ peminjamanId, units }: { peminjamanId: number; units: UnitForm[] }) {
  const [kondisi, setKondisi] = useState<Record<number, KondisiMasuk>>({});
  const [catatan, setCatatan] = useState<Record<number, string>>({});
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [cobaSimpan, setCobaSimpan] = useState(false);
  const s = useSubmitDenganFoto("pengembalian", peminjamanId);

  const butuhCatatan = (id: number) => kondisi[id] === "rusak" || kondisi[id] === "hilang";
  const kurang = units.filter((u) => !kondisi[u.detailId] || (butuhCatatan(u.detailId) && !catatan[u.detailId]?.trim()));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setCobaSimpan(true);
        if (kurang.length) {
          s.setError(`Lengkapi kondisi masuk (dan catatan untuk rusak/hilang): ${kurang.map((u) => u.kodeAset).join(", ")}.`);
          return;
        }
        s.submit(photos, (id, foto) =>
          simpanPengembalian({
            peminjamanId,
            pengembalianId: id,
            units: units.map((u) => ({
              detail_id: u.detailId,
              kondisi_masuk: kondisi[u.detailId],
              catatan: catatan[u.detailId] ?? "",
            })),
            foto,
          }),
        );
      }}
      className="space-y-6"
    >
      <Card>
        <h2 className="text-base font-semibold text-gray-900">Kondisi Masuk per Unit</h2>
        <ul className="divide-y divide-gray-100">
          {units.map((u) => (
            <li key={u.detailId} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div>
                <p className="font-mono font-semibold text-gray-900">{u.kodeAset}</p>
                <p className="text-sm text-gray-500">{u.namaAset} · {u.kategoriNama}</p>
                {u.kondisiKeluar && <p className="text-xs text-gray-400">Kondisi keluar: {u.kondisiKeluar}</p>}
              </div>
              <div className="space-y-2">
                <fieldset className="flex flex-wrap gap-4" aria-label={`Kondisi masuk ${u.kodeAset}`}>
                  {(["baik", "rusak", "hilang"] as const).map((k) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <Radio
                        name={`masuk-${u.detailId}`}
                        value={k}
                        checked={kondisi[u.detailId] === k}
                        onChange={() => setKondisi((prev) => ({ ...prev, [u.detailId]: k }))}
                        disabled={s.pending}
                      />
                      {k === "baik" ? "Baik" : k === "rusak" ? "Rusak" : "Hilang"}
                    </label>
                  ))}
                </fieldset>
                <Textarea
                  rows={2}
                  placeholder={butuhCatatan(u.detailId) ? "Catatan wajib: jelaskan kerusakan / kronologi hilang" : "Catatan (opsional)"}
                  value={catatan[u.detailId] ?? ""}
                  onChange={(e) => setCatatan((prev) => ({ ...prev, [u.detailId]: e.target.value }))}
                  disabled={s.pending}
                  maxLength={BATAS.catatan}
                  color={cobaSimpan && butuhCatatan(u.detailId) && !catatan[u.detailId]?.trim() ? "failure" : undefined}
                  aria-label={`Catatan ${u.kodeAset}`}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-gray-900">Foto Pengembalian</h2>
        <PhotoPicker photos={photos} onChange={setPhotos} disabled={s.pending} />
      </Card>

      {s.error && <Alert color="failure" onDismiss={() => s.setError(null)}>{s.error}</Alert>}
      <div className="flex items-center justify-end gap-3">
        {s.tahap && <span className="flex items-center gap-2 text-sm text-gray-500"><Spinner size="sm" />{s.tahap}</span>}
        <Button type="submit" size="lg" color="green" disabled={s.pending}>Simpan Pengembalian</Button>
      </div>
    </form>
  );
}
