"use client";

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LuTrash2, LuTriangleAlert, LuX } from "react-icons/lu";
import { Button, cn, type ButtonVariant } from "@/components/ui";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Kunci scroll body, Escape untuk menutup, fokus terperangkap di panel, dan fokus dikembalikan saat ditutup. */
function useOverlay(open: boolean, onClose: () => void) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const el = panel.current;
    const first = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el;
    first?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const a = items[0];
      const z = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === a || document.activeElement === el)) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus?.({ preventScroll: true });
    };
  }, [open]);

  return panel;
}

const tanpaLangganan = () => () => {};

/** true setelah hydrate di browser (portal butuh document.body). */
export function useMounted() {
  return useSyncExternalStore(tanpaLangganan, () => true, () => false);
}

/**
 * Panel form: bottom sheet di ponsel, modal mengambang di tablet/desktop.
 * `footer` menempel di bawah supaya tombol aksi selalu terlihat.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
  dismissible?: boolean;
}) {
  const mounted = useMounted();
  const panel = useOverlay(open, () => dismissible && onClose());
  const titleId = useId();
  const descId = useId();
  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 animate-fade-in bg-gray-950/40 backdrop-blur-[2px]"
        onClick={() => dismissible && onClose()}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full animate-sheet-in flex-col rounded-t-2xl bg-white shadow-2xl focus:outline-none sm:max-h-[88dvh] sm:animate-pop-in sm:rounded-2xl",
          size === "lg" ? "sm:max-w-xl" : "sm:max-w-md",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-300 sm:hidden" aria-hidden />
        <div className="flex shrink-0 items-start gap-2 px-5 pt-3 pb-2 sm:pt-5">
          <div className="min-w-0 flex-1 pt-1.5">
            <h2 id={titleId} className="text-lg leading-6 font-bold text-gray-900">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-0.5 text-sm text-gray-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-me-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-gray-600 hover:bg-gray-100"
            aria-label="Tutup"
          >
            <LuX className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-gray-100 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Dua tombol sejajar untuk footer sheet/dialog: Batal (sekunder) + aksi utama. */
export function SheetActions({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

/** Dialog konfirmasi untuk aksi berisiko. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Ya, lanjutkan",
  cancelLabel = "Batal",
  variant = "danger",
  icon = "trash",
  pending,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Extract<ButtonVariant, "danger" | "primary">;
  icon?: "trash" | "warning" | "none";
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const mounted = useMounted();
  const panel = useOverlay(open, () => !pending && onClose());
  const titleId = useId();
  const descId = useId();
  if (!mounted || !open) return null;
  const Icon = icon === "trash" ? LuTrash2 : LuTriangleAlert;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
      <div
        className="absolute inset-0 animate-fade-in bg-gray-950/40 backdrop-blur-[2px]"
        onClick={() => !pending && onClose()}
        aria-hidden
      />
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className="relative w-full max-w-sm animate-pop-in rounded-2xl bg-white p-5 shadow-2xl focus:outline-none"
      >
        {icon !== "none" && (
          <span
            className={cn(
              "mb-3 grid h-11 w-11 place-items-center rounded-full",
              variant === "danger" ? "bg-red-100 text-red-800" : "bg-brand-50 text-brand-700",
            )}
            aria-hidden
          >
            <Icon className="h-[22px] w-[22px]" />
          </span>
        )}
        <h2 id={titleId} className="text-lg font-bold text-gray-900">
          {title}
        </h2>
        <div id={descId} className="mt-1.5 text-sm leading-5 break-words text-gray-600">
          {message}
        </div>
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose} disabled={pending} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
