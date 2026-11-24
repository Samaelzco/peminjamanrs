"use client";

import { useState, useTransition } from "react";
import { Alert, Button, HelperText, Label, Spinner, Textarea, TextInput } from "flowbite-react";
import { perpanjangPeminjaman } from "../../actions";

export function PerpanjangForm({ peminjamanId, defaultTanggal }: { peminjamanId: number; defaultTanggal: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        setFieldErrors({});
        startTransition(async () => {
          const res = await perpanjangPeminjaman({
            peminjamanId,
            tgl_rencana_kembali: String(fd.get("tgl_rencana_kembali") ?? ""),
            alasan: String(fd.get("alasan") ?? ""),
          });
          if (res && !res.ok) {
            setError(res.error);
            setFieldErrors(res.fieldErrors ?? {});
          }
        });
      }}
    >
      {error && <Alert color="failure">{error}</Alert>}
      <div>
        <Label htmlFor="tgl_rencana_kembali" className="mb-1.5 block">Rencana kembali baru (WITA)</Label>
        <TextInput id="tgl_rencana_kembali" name="tgl_rencana_kembali" type="datetime-local" defaultValue={defaultTanggal} required />
        {fieldErrors.tgl_rencana_kembali && <HelperText color="failure">{fieldErrors.tgl_rencana_kembali[0]}</HelperText>}
      </div>
      <div>
        <Label htmlFor="alasan" className="mb-1.5 block">Alasan perpanjangan</Label>
        <Textarea id="alasan" name="alasan" rows={3} required maxLength={300} />
        <HelperText color={fieldErrors.alasan ? "failure" : undefined}>
          {fieldErrors.alasan?.[0] ?? "Alasan ditambahkan ke keperluan pada peminjaman baru."}
        </HelperText>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending && <Spinner size="sm" className="me-2" />}
          Perpanjang
        </Button>
      </div>
    </form>
  );
}
