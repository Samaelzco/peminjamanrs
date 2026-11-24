"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Label, Modal, ModalBody, ModalFooter, ModalHeader, Textarea } from "flowbite-react";
import {
  HiOutlineArrowUturnLeft,
  HiOutlineCalendarDays,
  HiOutlineWrenchScrewdriver,
  HiOutlineXCircle,
} from "react-icons/hi2";
import { ResultAlert, useAction } from "@/components/feedback";
import type { StatusPeminjaman } from "@/lib/labels";
import { batalkanPeminjaman } from "../actions";

type Props = {
  id: number;
  kode: string;
  status: StatusPeminjaman;
  tglRencanaKembali: string;
  can: { pemasangan: boolean; pengembalian: boolean; extend: boolean; cancel: boolean };
};

export function AksiPeminjaman({ id, kode, status, can }: Props) {
  const action = useAction();
  const [batal, setBatal] = useState(false);
  const berjalan = status === "dipinjam" || status === "terlambat";

  return (
    <div className="flex flex-col items-stretch gap-2 lg:items-end">
      <div className="flex flex-wrap gap-2">
        {status === "diajukan" && can.pemasangan && (
          <Button as={Link} href={`/peminjaman/${id}/pemasangan`}>
            <HiOutlineWrenchScrewdriver className="me-1.5 h-4 w-4" />
            Pemasangan
          </Button>
        )}
        {berjalan && can.pengembalian && (
          <Button as={Link} href={`/peminjaman/${id}/pengembalian`} color="green">
            <HiOutlineArrowUturnLeft className="me-1.5 h-4 w-4" />
            Pengembalian
          </Button>
        )}
        {berjalan && can.extend && (
          <Button as={Link} href={`/peminjaman/${id}/perpanjang`} color="light">
            <HiOutlineCalendarDays className="me-1.5 h-4 w-4" />
            Perpanjang
          </Button>
        )}
        {status === "diajukan" && can.cancel && (
          <Button color="red" onClick={() => setBatal(true)}>
            <HiOutlineXCircle className="me-1.5 h-4 w-4" />
            Batalkan
          </Button>
        )}
      </div>
      {action.result?.ok && <ResultAlert result={action.result} onDismiss={action.reset} />}

      <Modal show={batal} size="md" onClose={() => setBatal(false)} dismissible>
        <ModalHeader>Batalkan {kode}</ModalHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const alasan = String(new FormData(e.currentTarget).get("alasan") ?? "");
            action.run(() => batalkanPeminjaman(id, alasan), () => setBatal(false));
          }}
        >
          <ModalBody>
            {action.result && !action.result.ok && (
              <Alert color="failure" className="mb-4">{action.result.error}</Alert>
            )}
            <p className="mb-4 text-sm text-gray-600">
              Peminjaman akan dibatalkan dan semua unitnya kembali tersedia untuk dipinjam.
            </p>
            <Label htmlFor="alasan" className="mb-1.5 block">Alasan (opsional)</Label>
            <Textarea id="alasan" name="alasan" rows={2} maxLength={300} />
          </ModalBody>
          <ModalFooter className="justify-end">
            <Button color="alternative" onClick={() => setBatal(false)} disabled={action.pending}>Tutup</Button>
            <Button color="red" type="submit" disabled={action.pending}>
              {action.pending ? "Membatalkan..." : "Batalkan Peminjaman"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
