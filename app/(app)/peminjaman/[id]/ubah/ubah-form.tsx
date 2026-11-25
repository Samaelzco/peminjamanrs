"use client";

import { useState, useTransition } from "react";
import { DateTimeField } from "@/components/datetime-field";
import { Alert, Button, ButtonLink, Card, CardTitle, Field, Input, Select, Textarea } from "@/components/ui";
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
      className="grid gap-3 lg:grid-cols-2 lg:items-start lg:gap-4"
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
        <CardTitle className="mb-3">Data Peminjam</CardTitle>
        <div className="space-y-4">
          <Field id="nama_peminjam" label="Nama Peminjam" error={fe("nama_peminjam")}>
            <Input id="nama_peminjam" name="nama_peminjam" defaultValue={awal.nama_peminjam} maxLength={BATAS.namaOrang} invalid={!!fe("nama_peminjam")} required />
          </Field>
          <Field id="kontak_peminjam" label="Nomor Kontak" error={fe("kontak_peminjam")}>
            <Input
              id="kontak_peminjam"
              type="tel"
              inputMode="numeric"
              maxLength={BATAS.kontakMax}
              value={kontak}
              onChange={(e) => setKontak(hanyaAngka(e.target.value).slice(0, BATAS.kontakMax))}
              invalid={!!fe("kontak_peminjam")}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="divisi_peminjam" label="Unit Peminjam" error={fe("divisi_peminjam")}>
              <Input id="divisi_peminjam" name="divisi_peminjam" defaultValue={awal.divisi_peminjam} maxLength={BATAS.divisi} invalid={!!fe("divisi_peminjam")} required />
            </Field>
            <Field id="ruangan" label="Ruangan" error={fe("ruangan")}>
              <Input id="ruangan" name="ruangan" defaultValue={awal.ruangan} maxLength={BATAS.ruangan} invalid={!!fe("ruangan")} required />
            </Field>
          </div>
          <Field id="keperluan" label="Alasan Peminjaman" error={fe("keperluan")}>
            <Textarea id="keperluan" name="keperluan" rows={4} defaultValue={awal.keperluan} maxLength={BATAS.keperluanDb} invalid={!!fe("keperluan")} required />
          </Field>
        </div>
      </Card>

      <div className="space-y-3 lg:sticky lg:top-20 lg:space-y-4">
        <Card>
          <CardTitle className="mb-3">Jadwal (WITA)</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="tgl_peminjaman" label="Tanggal Keluar">
              <DateTimeField id="tgl_peminjaman" name="tgl_peminjaman" defaultValue={awal.tgl_peminjaman} required error={fe("tgl_peminjaman")} />
            </Field>
            <Field id="tgl_rencana_kembali" label="Tanggal Kembali">
              <DateTimeField
                id="tgl_rencana_kembali"
                name="tgl_rencana_kembali"
                defaultValue={awal.tgl_rencana_kembali}
                required
                error={fe("tgl_rencana_kembali")}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle className="mb-3">Status</CardTitle>
          <div className="space-y-4">
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
          {status !== awal.status && KET_STATUS[status] && <Alert tone="warning">{KET_STATUS[status]}</Alert>}
          <Field id="keterangan" label="Keterangan perubahan (opsional)" error={fe("keterangan")}>
            <Textarea id="keterangan" name="keterangan" rows={2} maxLength={BATAS.alasan} placeholder="Mis. salah input nomor kontak" />
          </Field>
          </div>
        </Card>

        {error && (
          <Alert tone="danger" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        <div className="grid grid-cols-2 gap-3">
          <ButtonLink href={`/peminjaman/${peminjamanId}`} variant="secondary">
            Batal
          </ButtonLink>
          <Button type="submit" loading={pending}>
            Simpan Perubahan
          </Button>
        </div>
      </div>
    </form>
  );
}

