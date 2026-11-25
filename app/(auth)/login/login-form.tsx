"use client";

import { useActionState, useState } from "react";
import { LuEye, LuEyeOff } from "react-icons/lu";
import { Alert, Button, Field, Input } from "@/components/ui";
import { login, type LoginState } from "./actions";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {
    error: initialError,
  });
  const [lihat, setLihat] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <Field id="email" label="Email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="nama@rsupngoerah.go.id"
          maxLength={254}
          defaultValue={state.email}
          required
        />
      </Field>
      <Field id="password" label="Password">
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={lihat ? "text" : "password"}
            autoComplete="current-password"
            maxLength={72}
            className="pe-12"
            required
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
      </Field>
      <Button type="submit" block loading={pending} className="mt-1">
        Masuk
      </Button>
    </form>
  );
}
