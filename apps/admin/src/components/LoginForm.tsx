"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { login, type FormState } from "@/app/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-ink-2 disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(login, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3">
          Email
        </span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3">
          Password
        </span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm"
        />
      </label>

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-flame/30 bg-flame/10 px-3 py-2 text-sm text-flame"
        >
          {state.error}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}
