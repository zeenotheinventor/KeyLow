"use client";

import { GENERIC_ERROR } from "@keylow/core/copy";
import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";

import type { LoginFormProps, PendingAction } from "./types";

import { GoogleButton } from "@/components/auth/GoogleButton";
import { OrDivider } from "@/components/auth/OrDivider";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Input";
import {
  describeFailure,
  hasFieldErrors,
  validateCredentials,
  type FieldErrors,
} from "@/lib/auth/credentials";
import { describeClearedTermsPendingCookie } from "@/lib/auth/termsPendingCookie";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ linkError }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(linkError ?? null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  async function runPending(action: PendingAction, request: () => Promise<void>) {
    setPendingAction(action);
    try {
      await request();
    } catch {
      setFormError(GENERIC_ERROR);
    } finally {
      setPendingAction(null);
    }
  }

  async function signIn() {
    const trimmedEmail = email.trim();
    const errors = validateCredentials(trimmedEmail, password, { enforcePasswordLength: false });

    setFormError(null);
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) {
      return;
    }

    await runPending("signIn", async () => {
      const { error } = await createClient().auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) {
        setFormError(describeFailure(error));
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    });
  }

  async function signInWithGoogle() {
    setFormError(null);
    // A tick left from an abandoned sign-up must not count as consent for a sign-in made here.
    document.cookie = describeClearedTermsPendingCookie();

    await runPending("google", async () => {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setFormError(describeFailure(error));
      }
    });
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void signIn();
  }

  // The button that is running shows its spinner at full strength. The other is dimmed and waits.
  const isWaiting = (action: PendingAction) => pendingAction !== null && pendingAction !== action;

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
        }}
        error={fieldErrors.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
        }}
        error={fieldErrors.password}
      />

      {formError !== null && <Banner tone="error">{formError}</Banner>}

      <Button
        type="submit"
        className="mt-1"
        loading={pendingAction === "signIn"}
        loadingLabel="Signing in"
        disabled={isWaiting("signIn")}
      >
        Sign in
      </Button>

      <OrDivider />

      <GoogleButton
        loading={pendingAction === "google"}
        disabled={isWaiting("google")}
        onClick={() => {
          void signInWithGoogle();
        }}
      />
    </form>
  );
}
