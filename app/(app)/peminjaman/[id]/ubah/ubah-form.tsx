"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert, Button, Card, HelperText, Label, Select, Spinner, Textarea, TextInput } from "flowbite-react";
import { DateTimeField } from "@/components/datetime-field";
import { STATUS_PEMINJAMAN, type StatusPeminjaman } from "@/lib/labels";
import { BATAS, hanyaAngka } from "@/lib/validation";
import { ubahPeminjaman } from "../../actions";

type Awal = {
  nama_peminjam: string;
  kontak_peminjam: string;
  divisi_peminjam: string;
  ruangan: string;
  keperluan: string;
  tgl_peminjaman: string;
  tgl_rencana_kembali: string;
  status: StatusPeminjaman;
};

const KET_STATUS: Partial<Record<StatusPeminjaman, string>> = {
  selesai: "Unit yang masih dipinjam kembali tersedia (tanpa catatan pengembalian).",
  dibatalkan: "Unit dilepas dari peminjaman ini dan kembali tersedia.",
};

export function UbahForm({
  peminjamanId,
  awal,
  opsiStatus,
  statusDikunci,
  terpasang,
}: {
  peminjamanId: number;
  awal: Awal;
  opsiStatus: StatusPeminjaman[];
  statusDikunci: string | null;
  terpasang: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [kontak, setKontak] = useState(awal.kontak_peminjam);
  const [status, setStatus] = useState<StatusPeminjaman>(awal.status);
  const fe = (k: string) => fieldErrors[k]?.[0];

  return (
    <form
      noValidate
      className="grid gap-6 xl:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        setFieldErrors({});
        startTransition(async () => {
          const res = await ubahPeminjaman({
            peminjamanId,
            nama_peminjam: String(fd.get("nama_peminjam") ?? ""),
            kontak_peminjam: kontak,
            divisi_peminjam: String(fd.get("divisi_peminjam") ?? ""),
            ruangan: String(fd.get("ruangan") ?? ""),
            keperluan: String(fd.get("keperluan") ?? ""),
            tgl_peminjaman: String(fd.get("tgl_peminjaman") ?? ""),
            tgl_rencana_kembali: String(fd.get("tgl_rencana_kembali") ?? ""),
            status,
            keterangan: String(fd.get("keterangan") ?? ""),
          });
          // Kalau berhasil, server action melakukan redirect ke halaman detail.
          if (res && !res.ok) {
            setError(res.error);
            setFieldErrors(res.fieldErrors ?? {});
          }
        });
      }}
    >
      <Card>
        <h2 className="text-base font-semibold text-gray-900">Data Peminjam</h2>
        <div className="space-y-4">
          <Field id="nama_peminjam" label="Nama peminjam" error={fe("nama_peminjam")}>
            <TextInput id="nama_peminjam" name="nama_peminjam" defaultValue={awal.nama_peminjam} maxLength={BATAS.namaOrang} required />
          </Field>
          <Field id="kontak_peminjam" label="Nomor kontak" error={fe("kontak_peminjam")}>
            <TextInput
              id="kontak_peminjam"
              type="tel"
              inputMode="numeric"
              maxLength={BATAS.kontakMax}
              value={kontak}
              onChange={(e) => setKontak(hanyaAngka(e.target.value).slice(0, BATAS.kontakMax))}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="divisi_peminjam" label="Divisi" error={fe("divisi_peminjam")}>
              <TextInput id="divisi_peminjam" name="divisi_peminjam" defaultValue={awal.divisi_peminjam} maxLength={BATAS.divisi} required />
            </Field>
            <Field id="ruangan" label="Ruangan" error={fe("ruangan")}>
              <TextInput id="ruangan" name="ruangan" defaultValue={awal.ruangan} maxLength={BATAS.ruangan} required />
            </Field>
          </div>
          <Field id="keperluan" label="Keperluan" error={fe("keperluan")}>
            <Textarea id="keperluan" name="keperluan" rows={4} defaultValue={awal.keperluan} maxLength={BATAS.keperluanDb} required />
          </Field>
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <h2 className="text-base font-semibold text-gray-900">Jadwal (WITA)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="tgl_peminjaman" className="mb-1.5 block">Tanggal & jam keluar</Label>
              <DateTimeField id="tgl_peminjaman" name="tgl_peminjaman" defaultValue={awal.tgl_peminjaman} required error={fe("tgl_peminjaman")} />
            </div>
            <div>
              <Label htmlFor="tgl_rencana_kembali" className="mb-1.5 block">Rencana kembali</Label>
              <DateTimeField
                id="tgl_rencana_kembali"
                name="tgl_rencana_kembali"
                defaultValue={awal.tgl_rencana_kembali}
                required
                error={fe("tgl_rencana_kembali")}
              />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-gray-900">Status</h2>
          <Field id="status" label={`Status (unit ${terpasang ? "sudah" : "belum"} dipasang)`} error={fe("status")}>
            <Select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusPeminjaman)}
              disabled={!!statusDikunci}
            >
              {opsiStatus.map((s) => (
                <option key={s} value={s}>{STATUS_PEMINJAMAN[s].label}</option>
              ))}
            </Select>
          </Field>
          {statusDikunci && <p className="text-sm text-gray-500">{statusDikunci}</p>}
          {status !== awal.status && KET_STATUS[status] && <Alert color="warning">{KET_STATUS[status]}</Alert>}
          <Field id="keterangan" label="Keterangan perubahan (opsional)" error={fe("keterangan")}>
            <Textarea id="keterangan" name="keterangan" rows={2} maxLength={BATAS.alasan} placeholder="Mis. salah input nomor kontak" />
          </Field>
        </Card>

        {error && (
          <Alert color="failure" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        <div className="flex justify-end gap-2">
          <Button as={Link} href={`/peminjaman/${peminjamanId}`} color="alternative">
            Batal
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner size="sm" className="me-2" />}
            Simpan Perubahan
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block">{label}</Label>
      {children}
      {error && <HelperText color="failure">{error}</HelperText>}
    </div>
  );
}
