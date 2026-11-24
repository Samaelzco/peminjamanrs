"use client";

import { useCallback, useState, useTransition } from "react";
import { Alert, Button, Modal, ModalBody, ModalFooter, ModalHeader } from "flowbite-react";

export type ActionResultLike =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

/** Menjalankan server action dari client sambil menyimpan pesan hasilnya. */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResultLike | null>(null);

  const run = useCallback(
    (fn: () => Promise<ActionResultLike>, onSuccess?: () => void) => {
      startTransition(async () => {
        const res = await fn();
        setResult(res);
        if (res.ok) onSuccess?.();
      });
    },
    [],
  );

  const reset = useCallback(() => setResult(null), []);
  const fieldError = (name: string) =>
    result && !result.ok ? result.fieldErrors?.[name]?.[0] : undefined;

  return { pending, result, run, reset, fieldError, show: setResult };
}

export function ResultAlert({
  result,
  onDismiss,
}: {
  result: ActionResultLike | null;
  onDismiss?: () => void;
}) {
  if (!result) return null;
  if (result.ok && !result.message) return null;
  return (
    <Alert color={result.ok ? "success" : "failure"} onDismiss={onDismiss} className="mb-4">
      {result.ok ? result.message : result.error}
    </Alert>
  );
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Ya, lanjutkan",
  color = "red",
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  color?: "red" | "blue" | "yellow" | "green";
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal show={open} size="md" onClose={onClose} dismissible>
      <ModalHeader>{title}</ModalHeader>
      <ModalBody>
        <div className="text-sm text-gray-600">{message}</div>
      </ModalBody>
      <ModalFooter className="justify-end">
        <Button color="alternative" onClick={onClose} disabled={pending}>
          Batal
        </Button>
        <Button color={color} onClick={onConfirm} disabled={pending}>
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
