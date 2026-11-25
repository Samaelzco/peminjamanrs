"use client";

import { useDeferredValue, useState } from "react";
import { LuPlus, LuSearch } from "react-icons/lu";
import { ConfirmDialog, ResultAlert, useAction } from "@/components/feedback";
import { Sheet, SheetActions } from "@/components/overlay";
import { Button, Card, EmptyState, Field, Input, Pill, Select } from "@/components/ui";
import { formatTanggal } from "@/lib/datetime";
import { BATAS } from "@/lib/validation";
import { createAkun, toggleStatusAkun, updateAkun } from "./actions";

type Akun = {
  id: string;
  nama: string;
  email: string;
  status: "aktif" | "non_aktif";
  roleId: number;
  roleNama: string;
  createdAt: string;
};

type Props = {
  akun: Akun[];
  roles: { id: number; nama: string }[];
  currentUserId: string;
  canCreate: boolean;
  canUpdate: boolean;
  canToggle: boolean;
};

export function AkunTable({ akun, roles, currentUserId, canCreate, canUpdate, canToggle }: Props) {
  const page = useAction();
  const [form, setForm] = useState<{ mode: "create" } | { mode: "edit"; akun: Akun } | null>(null);
  const [toggle, setToggle] = useState<Akun | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const cari = useDeferredValue(q.trim().toLowerCase());
  const hasil = akun.filter(
    (a) =>
      (!role || String(a.roleId) === role) &&
      (!cari || a.nama.toLowerCase().includes(cari) || a.email.toLowerCase().includes(cari)),
  );

  return (
    <>
      <ResultAlert result={page.result} onDismiss={page.reset} />

      <Card className="mb-3">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-end">
          <Field id="cari-akun" label="Cari">
            <div className="relative">
              <Input
                id="cari-akun"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nama / email..."
                className="ps-10"
                maxLength={60}
              />
              <LuSearch className="pointer-events-none absolute inset-y-0 start-3 my-auto h-5 w-5 text-gray-400" aria-hidden />
            </div>
          </Field>
          <Field id="filter-role" label="Role">
            <Select id="filter-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Semua role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nama}
                </option>
              ))}
            </Select>
          </Field>
          {canCreate && (
            <Button block className="md:w-auto" onClick={() => setForm({ mode: "create" })}>
              <LuPlus className="h-4 w-4" aria-hidden />
              Tambah Akun
            </Button>
          )}
        </div>
      </Card>

      {hasil.length === 0 ? (
        <EmptyState>{akun.length === 0 ? "Belum ada akun." : "Tidak ada akun yang cocok."}</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {hasil.map((a) => {
            const self = a.id === currentUserId;
            const aktif = a.status === "aktif";
            return (
              <li key={a.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-[15px] font-bold break-words text-gray-900">
                    {a.nama}
                    {self && <span className="ms-1.5 text-xs font-normal text-gray-500">(Anda)</span>}
                  </p>
                  <Pill tone={aktif ? "green" : "gray"}>{aktif ? "Aktif" : "Non-aktif"}</Pill>
                </div>
                <p className="mt-0.5 text-sm break-all text-gray-600">{a.email}</p>
                <div className="mt-2">
                  <Pill tone="teal">{a.roleNama}</Pill>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <p className="text-xs text-gray-500">Dibuat {formatTanggal(a.createdAt)}</p>
                  <div className="flex gap-1">
                    {canUpdate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setForm({ mode: "edit", akun: a })}
                        aria-label={`Edit ${a.nama}`}
                      >
                        Edit
                      </Button>
                    )}
                    {canToggle && !self && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={aktif ? "text-red-800 hover:bg-red-50" : ""}
                        onClick={() => setToggle(a)}
                      >
                        {aktif ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {form && (
        <AkunSheet
          key={form.mode === "edit" ? form.akun.id : "create"}
          mode={form.mode}
          akun={form.mode === "edit" ? form.akun : undefined}
          roles={roles}
          self={form.mode === "edit" && form.akun.id === currentUserId}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null);
            page.show({ ok: true, message });
          }}
        />
      )}

      <ConfirmDialog
        open={!!toggle}
        title={toggle?.status === "aktif" ? "Nonaktifkan Akun?" : "Aktifkan Akun?"}
        message={
          toggle?.status === "aktif"
            ? `Akun ${toggle?.email} tidak akan bisa memakai aplikasi.`
            : `Akun ${toggle?.email} akan bisa memakai aplikasi kembali.`
        }
        confirmLabel={toggle?.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}
        variant={toggle?.status === "aktif" ? "danger" : "primary"}
        icon="warning"
        pending={page.pending}
        onClose={() => setToggle(null)}
        onConfirm={() => {
          if (!toggle) return;
          const target = toggle;
          page.run(() => toggleStatusAkun(target.id, target.status !== "aktif"), () => setToggle(null));
        }}
      />
    </>
  );
}

function AkunSheet({
  mode,
  akun,
  roles,
  self,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  akun?: Akun;
  roles: { id: number; nama: string }[];
  self: boolean;
  onClose: () => void;
  onSaved: (message?: string) => void;
}) {
  const action = useAction();
  const err = action.fieldError;

  function submit(formData: FormData) {
    const values = {
      nama: String(formData.get("nama") ?? ""),
      email: String(formData.get("email") ?? ""),
      role_id: String(formData.get("role_id") ?? ""),
      password: String(formData.get("password") ?? ""),
    };
    action.run(async () => {
      const res = mode === "create" ? await createAkun(values) : await updateAkun({ ...values, id: akun!.id });
      if (res.ok) onSaved(res.message);
      return res;
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={mode === "create" ? "Tambah Akun" : "Edit Akun"}
      description={mode === "create" ? "Akun baru untuk staf Administrasi / Sarpras" : akun?.email}
      dismissible={!action.pending}
      footer={
        <SheetActions>
          <Button variant="secondary" onClick={onClose} disabled={action.pending}>
            Batal
          </Button>
          <Button type="submit" form="form-akun" loading={action.pending}>
            Simpan
          </Button>
        </SheetActions>
      }
    >
      <form
        id="form-akun"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        {action.result && !action.result.ok && <ResultAlert result={action.result} className="" />}
        <Field id="nama" label="Nama Lengkap" error={err("nama")}>
          <Input
            id="nama"
            name="nama"
            maxLength={BATAS.namaOrang}
            defaultValue={akun?.nama}
            invalid={!!err("nama")}
            autoComplete="off"
            data-autofocus
            required
          />
        </Field>
        <Field id="email" label="Email" error={err("email")}>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="nama@rsupngoerah.go.id"
            maxLength={BATAS.email}
            defaultValue={akun?.email}
            invalid={!!err("email")}
            autoComplete="off"
            required
          />
        </Field>
        <Field id="password" label={mode === "create" ? "Password" : "Password Baru (opsional)"} error={err("password")}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            maxLength={BATAS.passwordMax}
            required={mode === "create"}
            placeholder={mode === "edit" ? "Kosongkan jika tidak diganti" : undefined}
            invalid={!!err("password")}
          />
        </Field>
        <Field
          id="role_id"
          label="Role"
          error={err("role_id")}
          hint={self ? "Anda tidak dapat mengubah role akun sendiri." : undefined}
        >
          <Select
            id="role_id"
            name="role_id"
            defaultValue={akun?.roleId ?? ""}
            required
            disabled={self}
            invalid={!!err("role_id")}
          >
            <option value="" disabled>
              Pilih role
            </option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nama}
              </option>
            ))}
          </Select>
          {self && <input type="hidden" name="role_id" value={akun?.roleId} />}
        </Field>
      </form>
    </Sheet>
  );
}
