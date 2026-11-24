"use client";

import { useState } from "react";
import { Alert, Button, Card, Label, Spinner, TextInput } from "flowbite-react";
import { HiOutlineArrowPath, HiOutlineExclamationTriangle } from "react-icons/hi2";
import { useAction } from "@/components/feedback";
import { resetDataDemo } from "./actions";

export function ResetPanel() {
  const action = useAction();
  const [konfirmasi, setKonfirmasi] = useState("");

  return (
    <Card className="h-fit border-red-200">
      <div className="flex items-center gap-2 text-red-700">
        <HiOutlineExclamationTriangle className="h-5 w-5" />
        <h2 className="text-base font-semibold">Reset Data Demo</h2>
      </div>
      <ul className="list-disc space-y-1 ps-5 text-sm text-gray-600">
        <li>Menghapus semua peminjaman, pemasangan, pengembalian, foto, log, dan notifikasi.</li>
        <li>Mengembalikan 4 kategori demo (Laptop, Proyektor, Webcam, Conf-Cam) dan 8 aset demo (TI-LPT-001 dst.) ke Tersedia/Baik; aset & kategori lain dihapus.</li>
        <li>Akun, role, dan permission tidak berubah.</li>
      </ul>

      {action.result && (
        <Alert color={action.result.ok ? "success" : "failure"} onDismiss={action.reset}>
          {action.result.ok ? action.result.message : action.result.error}
        </Alert>
      )}

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          action.run(() => resetDataDemo(konfirmasi), () => setKonfirmasi(""));
        }}
      >
        <div>
          <Label htmlFor="konfirmasi" className="mb-1.5 block">
            Ketik <span className="font-mono font-semibold">RESET</span> untuk konfirmasi
          </Label>
          <TextInput
            id="konfirmasi"
            value={konfirmasi}
            onChange={(e) => setKonfirmasi(e.target.value)}
            autoComplete="off"
            maxLength={10}
          />
        </div>
        <Button type="submit" color="red" className="w-full" disabled={konfirmasi !== "RESET" || action.pending}>
          {action.pending ? <Spinner size="sm" className="me-2" /> : <HiOutlineArrowPath className="me-2 h-4 w-4" />}
          Reset Data Demo
        </Button>
      </form>
    </Card>
  );
}
