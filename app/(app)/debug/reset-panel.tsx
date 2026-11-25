"use client";

import { useState } from "react";
import { LuRefreshCw, LuTriangleAlert } from "react-icons/lu";
import { useAction } from "@/components/feedback";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { resetDataDemo } from "./actions";

export function ResetPanel() {
  const action = useAction();
  const [konfirmasi, setKonfirmasi] = useState("");

  return (
    <Card className="h-fit border-red-200">
      <div className="flex items-center gap-2 text-red-800">
        <LuTriangleAlert className="h-5 w-5" aria-hidden />
        <h2 className="text-base font-semibold">Reset Data Demo</h2>
      </div>
      <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-gray-600">
        <li>Menghapus semua peminjaman, pemasangan, pengembalian, foto, log, dan notifikasi.</li>
        <li>
          Mengembalikan 4 kategori demo (Laptop, Proyektor, Webcam, Conf-Cam) dan 8 aset demo (TI-LPT-001 dst.) ke
          Tersedia/Baik; aset & kategori lain dihapus.
        </li>
        <li>Akun, role, dan permission tidak berubah.</li>
      </ul>

      {action.result && (
        <Alert tone={action.result.ok ? "success" : "danger"} onDismiss={action.reset} className="mt-4">
          {action.result.ok ? action.result.message : action.result.error}
        </Alert>
      )}

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          action.run(() => resetDataDemo(konfirmasi), () => setKonfirmasi(""));
        }}
      >
        <Field
          id="konfirmasi"
          label={
            <>
              Ketik <span className="font-mono">RESET</span> untuk konfirmasi
            </>
          }
        >
          <Input
            id="konfirmasi"
            value={konfirmasi}
            onChange={(e) => setKonfirmasi(e.target.value)}
            autoComplete="off"
            maxLength={10}
          />
        </Field>
        <Button type="submit" variant="danger" block disabled={konfirmasi !== "RESET"} loading={action.pending}>
          {!action.pending && <LuRefreshCw className="h-4 w-4" aria-hidden />}
          Reset Data Demo
        </Button>
      </form>
    </Card>
  );
}
