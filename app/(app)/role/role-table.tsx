"use client";

import Link from "next/link";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  Textarea,
  TextInput,
} from "flowbite-react";
import { HiOutlineKey, HiOutlinePencilSquare, HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import { ConfirmModal, ResultAlert, useAction } from "@/components/feedback";
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
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setForm({})}>
            <HiOutlinePlus className="me-1.5 h-4 w-4" />
            Tambah Role
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell>Role</TableHeadCell>
              <TableHeadCell>Deskripsi</TableHeadCell>
              <TableHeadCell>Akun</TableHeadCell>
              <TableHeadCell>Permission</TableHeadCell>
              <TableHeadCell>
                <span className="sr-only">Aksi</span>
              </TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody className="divide-y">
            {roles.map((r) => (
              <TableRow key={r.id} className="bg-white">
                <TableCell className="font-medium text-gray-900">
                  {r.nama}
                  {r.id === currentRoleId && (
                    <Badge color="info" className="ms-2 inline-flex">Role Anda</Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-xs">{r.deskripsi ?? "-"}</TableCell>
                <TableCell>{r.jumlahAkun}</TableCell>
                <TableCell>{r.jumlahPermission}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button as={Link} href={`/role/${r.id}`} size="xs" color="light">
                      <HiOutlineKey className="me-1 h-4 w-4" />
                      {canManage ? "Atur Permission" : "Lihat Permission"}
                    </Button>
                    {canManage && (
                      <>
                        <Button size="xs" color="light" onClick={() => setForm({ role: r })}>
                          <HiOutlinePencilSquare className="me-1 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          disabled={r.jumlahAkun > 0}
                          title={r.jumlahAkun > 0 ? "Role masih dipakai akun" : undefined}
                          onClick={() => setHapus(r)}
                        >
                          <HiOutlineTrash className="me-1 h-4 w-4" />
                          Hapus
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {form && (
        <RoleFormModal
          key={form.role?.id ?? "baru"}
          role={form.role}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null);
            page.show({ ok: true, message });
          }}
        />
      )}

      <ConfirmModal
        open={!!hapus}
        title="Hapus role"
        message={`Role "${hapus?.nama}" akan dihapus permanen. Lanjutkan?`}
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

function RoleFormModal({
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
    <Modal show size="md" onClose={onClose} dismissible>
      <ModalHeader>{role ? "Edit Role" : "Tambah Role"}</ModalHeader>
      <form onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}>
        <ModalBody>
          {action.result && !action.result.ok && <ResultAlert result={action.result} />}
          <div className="space-y-4">
            <div>
              <Label htmlFor="nama" className="mb-1.5 block">Nama role</Label>
              <TextInput id="nama" name="nama" maxLength={BATAS.namaRole} defaultValue={role?.nama} required color={err("nama") ? "failure" : undefined} />
              {err("nama") && <HelperText color="failure">{err("nama")}</HelperText>}
            </div>
            <div>
              <Label htmlFor="deskripsi" className="mb-1.5 block">Deskripsi</Label>
              <Textarea id="deskripsi" name="deskripsi" rows={3} maxLength={BATAS.deskripsiRole} defaultValue={role?.deskripsi ?? ""} />
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
