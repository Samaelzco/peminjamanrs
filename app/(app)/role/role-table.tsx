"use client";

import { useState } from "react";
import { LuKeyRound, LuPlus } from "react-icons/lu";
import { ConfirmDialog, ResultAlert, useAction } from "@/components/feedback";
import { Sheet, SheetActions } from "@/components/overlay";
import { Button, ButtonLink, Field, Input, Pill, Textarea } from "@/components/ui";
import { BATAS } from "@/lib/validation";
import { createRole, deleteRole, updateRole } from "./actions";

type Role = {
  id: number;
  nama: string;
  deskripsi: string | null;
  jumlahAkun: number;
  jumlahPermission: number;
};

export function RoleTable({
  roles,
  currentRoleId,
  canManage,
}: {
  roles: Role[];
  currentRoleId: number;
  canManage: boolean;
}) {
  const page = useAction();
  const [form, setForm] = useState<{ role?: Role } | null>(null);
  const [hapus, setHapus] = useState<Role | null>(null);

  return (
    <>
      <ResultAlert result={page.result} onDismiss={page.reset} />

      {canManage && (
        <div className="mb-3 flex sm:justify-end">
          <Button block className="sm:w-auto" onClick={() => setForm({})}>
            <LuPlus className="h-4 w-4" aria-hidden />
            Tambah Role
          </Button>
        </div>
      )}

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((r) => (
          <li key={r.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-[15px] font-bold break-words text-gray-900">{r.nama}</p>
              {r.id === currentRoleId && <Pill tone="blue">Role Anda</Pill>}
            </div>
            <p className="mt-1 text-sm break-words text-gray-600">{r.deskripsi ?? "-"}</p>
            <p className="mt-2 text-xs text-gray-500">
              {r.jumlahAkun} akun · {r.jumlahPermission} permission
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-1 pt-3">
              <ButtonLink href={`/role/${r.id}`} variant="secondary" size="sm" className="me-auto">
                <LuKeyRound className="h-4 w-4" aria-hidden />
                {canManage ? "Atur Permission" : "Lihat Permission"}
              </ButtonLink>
              {canManage && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setForm({ role: r })} aria-label={`Edit ${r.nama}`}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-800 hover:bg-red-50"
                    disabled={r.jumlahAkun > 0}
                    title={r.jumlahAkun > 0 ? "Role masih dipakai akun" : undefined}
                    onClick={() => setHapus(r)}
                    aria-label={`Hapus ${r.nama}`}
                  >
                    Hapus
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {form && (
        <RoleSheet
          key={form.role?.id ?? "baru"}
          role={form.role}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null);
            page.show({ ok: true, message });
          }}
        />
      )}

      <ConfirmDialog
        open={!!hapus}
        title="Hapus Role?"
        message={
          <>
            Role <strong className="text-gray-900">{hapus?.nama}</strong> akan dihapus permanen. Tindakan ini tidak bisa
            dibatalkan.
          </>
        }
        confirmLabel="Hapus"
        pending={page.pending}
        onClose={() => setHapus(null)}
        onConfirm={() => {
          if (!hapus) return;
          const id = hapus.id;
          page.run(() => deleteRole(id), () => setHapus(null));
        }}
      />
    </>
  );
}

function RoleSheet({
  role,
  onClose,
  onSaved,
}: {
  role?: Role;
  onClose: () => void;
  onSaved: (message?: string) => void;
}) {
  const action = useAction();
  const err = action.fieldError;

  function submit(formData: FormData) {
    const values = {
      nama: String(formData.get("nama") ?? ""),
      deskripsi: String(formData.get("deskripsi") ?? ""),
    };
    action.run(async () => {
      const res = role ? await updateRole(role.id, values) : await createRole(values);
      if (res.ok) onSaved(res.message);
      return res;
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={role ? "Edit Role" : "Tambah Role"}
      dismissible={!action.pending}
      footer={
        <SheetActions>
          <Button variant="secondary" onClick={onClose} disabled={action.pending}>
            Batal
          </Button>
          <Button type="submit" form="form-role" loading={action.pending}>
            Simpan
          </Button>
        </SheetActions>
      }
    >
      <form
        id="form-role"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        {action.result && !action.result.ok && <ResultAlert result={action.result} className="" />}
        <Field id="nama" label="Nama Role" error={err("nama")}>
          <Input
            id="nama"
            name="nama"
            maxLength={BATAS.namaRole}
            defaultValue={role?.nama}
            invalid={!!err("nama")}
            data-autofocus
            required
          />
        </Field>
        <Field id="deskripsi" label="Deskripsi">
          <Textarea id="deskripsi" name="deskripsi" rows={3} maxLength={BATAS.deskripsiRole} defaultValue={role?.deskripsi ?? ""} />
        </Field>
      </form>
    </Sheet>
  );
}
