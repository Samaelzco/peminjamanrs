"use client";

import { useState, useTransition } from "react";
import { DateTimeField } from "@/components/datetime-field";
import { Alert, Button, ButtonLink, Field, Textarea } from "@/components/ui";
import { BATAS } from "@/lib/validation";
import { perpanjangPeminjaman } from "../../actions";

export function PerpanjangForm({ peminjamanId, defaultTanggal }: { peminjamanId: number; defaultTanggal: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [alasan, setAlasan] = useState("");

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        setFieldErrors({});
        startTransition(async () => {
          const res = await perpanjangPeminjaman({
            peminjamanId,
            tgl_rencana_kembali: String(fd.get("tgl_rencana_kembali") ?? ""),
            alasan,
          });
          if (res && !res.ok) {
            setError(res.error);
            setFieldErrors(res.fieldErrors ?? {});
          }
        });
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field id="tgl_rencana_kembali" label="Tanggal kembali baru (WITA)">
        <DateTimeField
          id="tgl_rencana_kembali"
          name="tgl_rencana_kembali"
          defaultValue={defaultTanggal}
          required
          error={fieldErrors.tgl_rencana_kembali?.[0]}
        />
      </Field>
      <Field id="alasan" label="Alasan perpanjangan" error={fieldErrors.alasan?.[0]}>
        <Textarea
          id="alasan"
          name="alasan"
          rows={3}
          required
          maxLength={BATAS.alasan}
          value={alasan}
          onChange={(e) => setAlasan(e.target.value)}
          invalid={!!fieldErrors.alasan}
          placeholder="Contoh: kegiatan diperpanjang satu hari"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3 pt-1">
        <ButtonLink href={`/peminjaman/${peminjamanId}`} variant="secondary">
          Batal
        </ButtonLink>
        <Button type="submit" loading={pending}>
          Perpanjang
        </Button>
      </div>
    </form>
  );
}
