"use client";

import { useState } from "react";
import { LuCalendarPlus, LuPencil, LuUndo2, LuWrench, LuX } from "react-icons/lu";
import { ConfirmDialog } from "@/components/overlay";
import { ResultAlert, useAction } from "@/components/feedback";
import { Alert, Button, ButtonLink } from "@/components/ui";
import type { StatusPeminjaman } from "@/lib/labels";
import { batalkanPeminjaman } from "../actions";

type Props = {
  id: number;
  kode: string;
  status: StatusPeminjaman;
  terpasang: boolean;
  can: { pemasangan: boolean; pengembalian: boolean; extend: boolean; cancel: boolean; update: boolean };
};

export function AksiPeminjaman({ id, kode, status, terpasang, can }: Props) {
  const action = useAction();
  const [batal, setBatal] = useState(false);
  // Belum dipasang: diajukan, atau terlambat sejak dicatat (rencana kembali sudah lewat).
  const menungguPasang = (status === "diajukan" || status === "terlambat") && !terpasang;
  const berjalan = (status === "dipinjam" || status === "terlambat") && terpasang;

  const tombol = [
    menungguPasang && can.pemasangan && (
      <ButtonLink key="pasang" href={`/peminjaman/${id}/pemasangan`} block>
        <LuWrench className="h-4 w-4" aria-hidden />
        Validasi Pemasangan
      </ButtonLink>
    ),
    berjalan && can.pengembalian && (
      <ButtonLink key="kembali" href={`/peminjaman/${id}/pengembalian`} block>
        <LuUndo2 className="h-4 w-4" aria-hidden />
        Validasi Pengembalian
      </ButtonLink>
    ),
    berjalan && can.extend && (
      <ButtonLink key="perpanjang" href={`/peminjaman/${id}/perpanjang`} variant="secondary" block>
        <LuCalendarPlus className="h-4 w-4" aria-hidden />
        Perpanjang Peminjaman
      </ButtonLink>
    ),
    can.update && (
      <ButtonLink key="ubah" href={`/peminjaman/${id}/ubah`} variant="secondary" block>
        <LuPencil className="h-4 w-4" aria-hidden />
        Ubah Data
      </ButtonLink>
    ),
    menungguPasang && can.cancel && (
      <Button key="batal" variant="danger-soft" block onClick={() => setBatal(true)}>
        <LuX className="h-4 w-4" aria-hidden />
        Batalkan Peminjaman
      </Button>
    ),
  ].filter(Boolean);

  if (tombol.length === 0 && !action.result) return null;

  return (
    <div className="space-y-2.5">
      {action.result?.ok && <ResultAlert result={action.result} onDismiss={action.reset} />}
      {tombol}

      <ConfirmDialog
        open={batal}
        title="Batalkan Peminjaman?"
        message={`Yakin membatalkan peminjaman id ${kode}`}
        confirmLabel="Yakin"
        cancelLabel="Tidak"
        icon="ban"
        pending={action.pending}
        onClose={() => {
          setBatal(false);
          action.reset();
        }}
        onConfirm={() => action.run(() => batalkanPeminjaman(id, ""), () => setBatal(false))}
      >
        {action.result && !action.result.ok && <Alert tone="danger">{action.result.error}</Alert>}
      </ConfirmDialog>
    </div>
  );
}
