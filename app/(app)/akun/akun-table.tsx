"use client";

import { useDeferredValue, useState } from "react";
import { LuCheck, LuEye, LuEyeOff } from "react-icons/lu";
import { ResultAlert, useAction, type ActionResultLike } from "@/components/feedback";
import { Sheet, SheetActions } from "@/components/overlay";
import { Button, Card, EmptyState, Field, Input, Pill, Select, cn } from "@/components/ui";
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

/** Nama role ringkas untuk pill (wireframe: "Administrasi", "Sarpras"). */
function roleRingkas(nama: string) {
  return nama === "Sarana dan Prasarana" ? "Sarpras" : nama;
}

export function AkunTable({ akun, roles, currentUserId, canCreate, canUpdate, canToggle }: Props) {
  const page = useAction();
  const [form, setForm] = useState<{ mode: "create" } | { mode: "edit"; akun: Akun } | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const cari = useDeferredValue(q.trim().toLowerCase());
  const hasil = akun.filter(
    (a) =>
      (!role || String(a.roleId) === role) &&
      (!status || a.status === status) &&
      (!cari || a.nama.toLowerCase().includes(cari) || a.email.toLowerCase().includes(cari)),
  );

  return (
    <>
      <ResultAlert result={page.result} onDismiss={page.reset} />

      <Card className="mb-3">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
          <Field id="cari-akun" label="Cari" className="col-span-2 xl:col-span-1">
            <Input
              id="cari-akun"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nama / email..."
              maxLength={60}
            />
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
          <Field id="filter-status" label="Status">
            <Select id="filter-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Semua</option>
              <option value="aktif">Aktif</option>
              <option value="non_aktif">Nonaktif</option>
            </Select>
          </Field>
          {canCreate && (
            <Button block className="col-span-2 xl:col-span-1 xl:w-auto" onClick={() => setForm({ mode: "create" })}>
              Tambah Akun
            </Button>
          )}
        </div>
      </Card>

      {hasil.length === 0 ? (
        <EmptyState>{akun.length === 0 ? "Belum ada akun." : "Tidak ada akun yang cocok."}</EmptyState>
      ) : (
        <ul className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {hasil.map((a) => {
            const self = a.id === currentUserId;
            const aktif = a.status === "aktif";
            return (
              <li key={a.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-[15px] font-bold break-words text-gray-900">
                    {a.nama}
                    {self && <span className="ms-1.5 text-xs font-normal text-gray-500">(Anda)</span>}
                  </p>
                  <Pill tone={aktif ? "green" : "gray"}>{aktif ? "Aktif" : "Nonaktif"}</Pill>
                </div>
                <div className="mt-0.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm break-all text-gray-600">{a.email}</p>
                    <Pill tone={a.roleNama === "Administrasi" ? "blue" : "teal"} className="mt-1.5">
                      {roleRingkas(a.roleNama)}
                    </Pill>
                  </div>
                  {canUpdate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-me-3 shrink-0"
                      onClick={() => setForm({ mode: "edit", akun: a })}
                      aria-label={`Edit ${a.nama}`}
                    >
                      Edit
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-500">Dibuat {formatTanggal(a.createdAt)}</p>
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
          canToggle={canToggle}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null);
            page.show({ ok: true, message });
          }}
        />
      )}
    </>
  );
}

function PasswordInput({
  id,
  name,
  invalid,
  required,
}: {
  id: string;
  name: string;
  invalid?: boolean;
  required?: boolean;
}) {
  const [lihat, setLihat] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={lihat ? "text" : "password"}
        autoComplete="new-password"
        maxLength={BATAS.passwordMax}
        placeholder={`Minimal ${BATAS.passwordMin} karakter`}
        required={required}
        invalid={invalid}
        className="pe-12"
      />
      <button
        type="button"
        onClick={() => setLihat((v) => !v)}
        className="absolute inset-y-0 end-0 grid w-11 place-items-center rounded-e-lg text-gray-700 hover:text-gray-900"
        aria-label={lihat ? "Sembunyikan password" : "Tampilkan password"}
        aria-pressed={lihat}
      >
        {lihat ? <LuEyeOff className="h-5 w-5" /> : <LuEye className="h-5 w-5" />}
      </button>
    </div>
  );
}

function AkunSheet({
  mode,
  akun,
  roles,
  self,
  canToggle,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  akun?: Akun;
  roles: { id: number; nama: string }[];
  self: boolean;
  canToggle: boolean;
  onClose: () => void;
  onSaved: (message?: string) => void;
}) {
  const action = useAction();
  const [aktif, setAktif] = useState(akun ? akun.status === "aktif" : true);
  const [konfirmasiError, setKonfirmasiError] = useState<string>();
  const err = action.fieldError;
  // Akun sendiri tidak boleh dinonaktifkan; tanpa izin toggle, centang dikunci.
  const bisaUbahAktif = canToggle && !self;

  function submit(formData: FormData) {
    const password = String(formData.get("password") ?? "");
    const konfirmasi = String(formData.get("password_konfirmasi") ?? "");
    if (password !== konfirmasi) {
      setKonfirmasiError("Konfirmasi password tidak sama.");
      return;
    }
    setKonfirmasiError(undefined);
    const values = {
      nama: String(formData.get("nama") ?? ""),
      email: String(formData.get("email") ?? ""),
      role_id: String(formData.get("role_id") ?? ""),
      password,
    };
    action.run(async (): Promise<ActionResultLike> => {
      if (mode === "create") {
        const res = await createAkun({ ...values, aktif });
        if (res.ok) onSaved(res.message);
        return res;
      }
      const res = await updateAkun({ ...values, id: akun!.id });
      if (!res.ok) return res;
      const statusBerubah = bisaUbahAktif && aktif !== (akun!.status === "aktif");
      if (statusBerubah) {
        const t = await toggleStatusAkun(akun!.id, aktif);
        if (!t.ok) return { ok: false, error: `Data tersimpan, tetapi status gagal diubah: ${t.error}` };
      }
      onSaved(statusBerubah ? `Data akun diperbarui dan akun ${aktif ? "diaktifkan" : "dinonaktifkan"}.` : res.message);
      return res;
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={mode === "create" ? "Tambah Akun" : "Edit Akun"}
      description={mode === "create" ? "Akun baru untuk staf Administrasi / Sarpras" : undefined}
      dismissible={!action.pending}
      footer={
        <SheetActions>
          <Button variant="secondary" onClick={onClose} disabled={action.pending}>
            Batal
          </Button>
          <Button type="submit" form="form-akun" loading={action.pending}>
            Simpan Akun
          </Button>
        </SheetActions>
      }
    >
      <form
        id="form-akun"
        className="space-y-4"
        noValidate
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
            placeholder="Nama staf"
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
        <Field
          id="password"
          label="Password"
          error={err("password")}
          hint={mode === "edit" ? "Kosongkan jika password tidak diganti." : undefined}
        >
          <PasswordInput id="password" name="password" invalid={!!err("password")} required={mode === "create"} />
        </Field>
        <Field id="password_konfirmasi" label="Konfirmasi Password" error={konfirmasiError}>
          <PasswordInput
            id="password_konfirmasi"
            name="password_konfirmasi"
            invalid={!!konfirmasiError}
            required={mode === "create"}
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
        <label
          className={cn(
            "flex min-h-11 w-fit items-center gap-3 text-sm font-medium text-gray-900",
            bisaUbahAktif ? "cursor-pointer" : "cursor-not-allowed opacity-60",
          )}
        >
          <span className="relative grid h-[22px] w-[22px] place-items-center">
            <input
              type="checkbox"
              checked={aktif}
              onChange={(e) => setAktif(e.target.checked)}
              disabled={!bisaUbahAktif}
              className="peer absolute inset-0 appearance-none rounded-md border-2 border-gray-400 bg-white checked:border-brand-700 checked:bg-brand-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            />
            <LuCheck className="pointer-events-none relative h-4 w-4 text-white opacity-0 peer-checked:opacity-100" aria-hidden />
          </span>
          Aktif
          {self && <span className="text-xs font-normal text-gray-500">(akun Anda)</span>}
        </label>
      </form>
    </Sheet>
  );
}
