"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  HelperText,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
} from "flowbite-react";
import { HiOutlinePencilSquare, HiOutlinePlus } from "react-icons/hi2";
import { ConfirmModal, ResultAlert, useAction } from "@/components/feedback";
import { formatWita } from "@/lib/datetime";
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

  return (
    <>
      <ResultAlert result={page.result} onDismiss={page.reset} />

      {canCreate && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setForm({ mode: "create" })}>
            <HiOutlinePlus className="me-1.5 h-4 w-4" />
            Tambah Akun
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell>Nama</TableHeadCell>
              <TableHeadCell>Email</TableHeadCell>
              <TableHeadCell>Role</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell>Dibuat</TableHeadCell>
              <TableHeadCell>
                <span className="sr-only">Aksi</span>
              </TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody className="divide-y">
            {akun.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500">
                  Belum ada akun.
                </TableCell>
              </TableRow>
            )}
            {akun.map((a) => {
              const self = a.id === currentUserId;
              return (
                <TableRow key={a.id} className="bg-white">
                  <TableCell className="font-medium text-gray-900">
                    {a.nama}
                    {self && <span className="ms-2 text-xs text-gray-400">(Anda)</span>}
                  </TableCell>
                  <TableCell>{a.email}</TableCell>
                  <TableCell>{a.roleNama}</TableCell>
                  <TableCell>
                    <Badge color={a.status === "aktif" ? "success" : "gray"} className="w-fit">
                      {a.status === "aktif" ? "Aktif" : "Non-aktif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatWita(a.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {canUpdate && (
                        <Button size="xs" color="light" onClick={() => setForm({ mode: "edit", akun: a })}>
                          <HiOutlinePencilSquare className="me-1 h-4 w-4" />
                          Edit
                        </Button>
                      )}
                      {canToggle && !self && (
                        <Button
                          size="xs"
                          color={a.status === "aktif" ? "red" : "green"}
                          onClick={() => setToggle(a)}
                        >
                          {a.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {form && (
        <AkunFormModal
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

      <ConfirmModal
        open={!!toggle}
        title={toggle?.status === "aktif" ? "Nonaktifkan akun" : "Aktifkan akun"}
        message={
          toggle?.status === "aktif"
            ? `Akun ${toggle?.email} tidak akan bisa memakai aplikasi. Lanjutkan?`
            : `Akun ${toggle?.email} akan bisa memakai aplikasi kembali. Lanjutkan?`
        }
        color={toggle?.status === "aktif" ? "red" : "green"}
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

function AkunFormModal({
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
    action.run(
      async () => {
        const res =
          mode === "create"
            ? await createAkun(values)
            : await updateAkun({ ...values, id: akun!.id });
        if (res.ok) onSaved(res.message);
        return res;
      },
    );
  }

  return (
    <Modal show size="md" onClose={onClose} dismissible>
      <ModalHeader>{mode === "create" ? "Tambah Akun" : "Edit Akun"}</ModalHeader>
      <form action={submit}>
        <ModalBody>
          {action.result && !action.result.ok && <ResultAlert result={action.result} />}
          <div className="space-y-4">
            <div>
              <Label htmlFor="nama" className="mb-1.5 block">Nama</Label>
              <TextInput id="nama" name="nama" defaultValue={akun?.nama} required color={err("nama") ? "failure" : undefined} />
              {err("nama") && <HelperText color="failure">{err("nama")}</HelperText>}
            </div>
            <div>
              <Label htmlFor="email" className="mb-1.5 block">Email</Label>
              <TextInput id="email" name="email" type="email" defaultValue={akun?.email} required color={err("email") ? "failure" : undefined} />
              {err("email") && <HelperText color="failure">{err("email")}</HelperText>}
            </div>
            <div>
              <Label htmlFor="password" className="mb-1.5 block">
                {mode === "create" ? "Password" : "Password baru (opsional)"}
              </Label>
              <TextInput
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required={mode === "create"}
                placeholder={mode === "edit" ? "Kosongkan jika tidak diganti" : "Minimal 8 karakter"}
                color={err("password") ? "failure" : undefined}
              />
              {err("password") && <HelperText color="failure">{err("password")}</HelperText>}
            </div>
            <div>
              <Label htmlFor="role_id" className="mb-1.5 block">Role</Label>
              <Select id="role_id" name="role_id" defaultValue={akun?.roleId ?? ""} required disabled={self}>
                <option value="" disabled>Pilih role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.nama}</option>
                ))}
              </Select>
              {self && (
                <>
                  <input type="hidden" name="role_id" value={akun?.roleId} />
                  <HelperText>Anda tidak dapat mengubah role akun Anda sendiri.</HelperText>
                </>
              )}
              {err("role_id") && <HelperText color="failure">{err("role_id")}</HelperText>}
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="justify-end">
          <Button color="alternative" onClick={onClose} disabled={action.pending}>Batal</Button>
          <Button type="submit" disabled={action.pending}>
            {action.pending ? "Menyimpan..." : "Simpan"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
