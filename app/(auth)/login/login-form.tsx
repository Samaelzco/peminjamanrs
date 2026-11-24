"use client";

import { useActionState } from "react";
import { Alert, Button, Label, Spinner, TextInput } from "flowbite-react";
import { login, type LoginState } from "./actions";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {
    error: initialError,
  });

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Alert color="failure">{state.error}</Alert>}
      <div>
        <Label htmlFor="email" className="mb-2 block">
          Email
        </Label>
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          maxLength={254}
          defaultValue={state.email}
          required
        />
      </div>
      <div>
        <Label htmlFor="password" className="mb-2 block">
          Password
        </Label>
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={72}
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending && <Spinner size="sm" className="me-2" />}
        Masuk
      </Button>
    </form>
  );
}
