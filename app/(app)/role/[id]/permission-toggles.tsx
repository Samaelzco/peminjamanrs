"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Alert, Card, ToggleSwitch } from "flowbite-react";
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
        <Alert color="info" className="mb-4">
          Anda hanya dapat melihat permission. Perubahan memerlukan permission role.manage.
        </Alert>
      )}
      {error && (
        <Alert color="failure" className="mb-4" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {optimistic.map((g) => (
          <Card key={g.modul}>
            <h2 className="text-base font-semibold text-gray-900">{g.modul}</h2>
            <ul className="space-y-3">
              {g.items.map((item) => {
                const locked = isOwnRole && item.nama === "role.manage" && item.aktif;
                return (
                  <li key={item.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-gray-900">{item.nama}</p>
                      <p className="text-xs text-gray-500">
                        {item.deskripsi}
                        {locked && " · tidak dapat dimatikan pada role Anda sendiri"}
                      </p>
                    </div>
                    <ToggleSwitch
                      checked={item.aktif}
                      disabled={!canManage || locked}
                      onChange={(v) => toggle(item, v)}
                      aria-label={item.nama}
                      sizing="sm"
                    />
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
