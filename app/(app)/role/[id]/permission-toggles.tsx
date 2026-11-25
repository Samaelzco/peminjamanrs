"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Alert, Card, CardTitle, cn } from "@/components/ui";
import { setRolePermission } from "../actions";

type Item = { id: number; nama: string; deskripsi: string | null; aktif: boolean };
type Group = { modul: string; items: Item[] };

export function PermissionToggles({
  roleId,
  isOwnRole,
  canManage,
  groups,
}: {
  roleId: number;
  isOwnRole: boolean;
  canManage: boolean;
  groups: Group[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    groups,
    (state, update: { id: number; aktif: boolean }) =>
      state.map((g) => ({
        ...g,
        items: g.items.map((i) => (i.id === update.id ? { ...i, aktif: update.aktif } : i)),
      })),
  );

  function toggle(item: Item, aktif: boolean) {
    setError(null);
    startTransition(async () => {
      setOptimistic({ id: item.id, aktif });
      const res = await setRolePermission(roleId, item.id, aktif);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <>
      {!canManage && (
        <Alert tone="info" className="mb-3">
          Anda hanya dapat melihat permission. Perubahan memerlukan permission role.manage.
        </Alert>
      )}
      {error && (
        <Alert tone="danger" className="mb-3" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      <div className="grid gap-3 md:grid-cols-2 lg:gap-4 xl:grid-cols-3">
        {optimistic.map((g) => (
          <Card key={g.modul}>
            <CardTitle className="mb-2">{g.modul}</CardTitle>
            <ul className="divide-y divide-gray-100">
              {g.items.map((item) => {
                const locked = isOwnRole && item.nama === "role.manage" && item.aktif;
                const disabled = !canManage || locked;
                return (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-mono text-sm break-all text-gray-900">{item.nama}</p>
                      <p className="text-xs text-gray-500">
                        {item.deskripsi}
                        {locked && " · tidak dapat dimatikan pada role Anda sendiri"}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.aktif}
                      aria-label={item.nama}
                      disabled={disabled}
                      onClick={() => toggle(item, !item.aktif)}
                      className="grid h-11 w-14 shrink-0 place-items-center rounded-full disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span
                        className={cn(
                          "relative h-6 w-11 rounded-full transition-colors duration-200",
                          item.aktif ? "bg-brand-700" : "bg-gray-300",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
                            item.aktif && "translate-x-5",
                          )}
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
