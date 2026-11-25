"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LuCircleCheck, LuX } from "react-icons/lu";
import { useMounted } from "@/components/overlay";
import { Alert } from "@/components/ui";

export { ConfirmDialog } from "@/components/overlay";

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

/** Error tampil sebagai alert di tempat; sukses tampil sebagai toast di pojok kanan bawah. */
export function ResultAlert({
  result,
  onDismiss,
  className = "mb-4",
}: {
  result: ActionResultLike | null;
  onDismiss?: () => void;
  className?: string;
}) {
  if (!result) return null;
  if (result.ok) {
    return result.message ? <Toast onDismiss={onDismiss}>{result.message}</Toast> : null;
  }
  return (
    <Alert tone="danger" onDismiss={onDismiss} className={className}>
      {result.error}
    </Alert>
  );
}

export function Toast({ children, onDismiss, duration = 4500 }: { children: ReactNode; onDismiss?: () => void; duration?: number }) {
  const mounted = useMounted();
  useEffect(() => {
    if (!onDismiss) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [onDismiss, duration]);
  if (!mounted) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-sm animate-pop-in items-start gap-2.5 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-xl lg:inset-x-auto lg:right-6 lg:bottom-6"
    >
      <LuCircleCheck className="mt-px h-[18px] w-[18px] shrink-0 text-green-400" aria-hidden />
      <p className="min-w-0 flex-1 break-words">{children}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="-m-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Tutup pesan"
        >
          <LuX className="h-4 w-4" />
        </button>
      )}
    </div>,
    document.body,
  );
}
