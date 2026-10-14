"use client";

import {
  AUTH_FIELD_PROBLEMS,
  CHECK_EMAIL_TITLE,
  GENERIC_ERROR,
  describeAuthError,
  describeCheckEmail,
} from "@keylow/core/copy";
import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import { Mail } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";

import type { FieldErrors, LoginFormProps, PendingAction } from "./types";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const PASSWORD_MIN_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Action = "signIn" | "signUp";

function validate(email: string, password: string, action: Action): FieldErrors {
  const errors: FieldErrors = {};

  if (email === "") {
    errors.email = AUTH_FIELD_PROBLEMS.emailRequired;
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = AUTH_FIELD_PROBLEMS.emailInvalid;
  }

  // Sign-in only needs a password, because accounts made under a shorter minimum must still work.
  if (password === "") {
    errors.password = AUTH_FIELD_PROBLEMS.passwordRequired;
  } else if (action === "signUp" && password.length < PASSWORD_MIN_LENGTH) {
    errors.password = AUTH_FIELD_PROBLEMS.passwordTooShort;
  }

  return errors;
}

// The server's message is never shown. A failed fetch has no code, so it is named for the copy.
function describeFailure(error: AuthError): string {
  return describeAuthError(isAuthRetryableFetchError(error) ? "network" : error.code);
}

export function LoginForm({ linkError }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(linkError ?? null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  function openDashboard() {
    router.push("/dashboard");
    router.refresh();
  }

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

  async function submit(action: Action) {
    const trimmedEmail = email.trim();
    const errors = validate(trimmedEmail, password, action);

    setFormError(null);
    setConfirmationEmail(null);
    setFieldErrors(errors);
    if (errors.email !== undefined || errors.password !== undefined) {
      return;
    }

    await runPending(action, async () => {
      const supabase = createClient();

      if (action === "signIn") {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) {
          setFormError(describeFailure(error));
        } else {
          openDashboard();
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) {
          setFormError(describeFailure(error));
        } else if (data.session) {
          openDashboard();
        } else {
          setConfirmationEmail(trimmedEmail);
        }
      }
    });
  }

  async function signInWithGoogle() {
    setFormError(null);
    setConfirmationEmail(null);

    await runPending("google", async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
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
    void submit("signIn");
  }

  // The button that is running shows its spinner at full strength. The others are dimmed and wait.
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
      {confirmationEmail !== null && (
        <Banner title={CHECK_EMAIL_TITLE} icon={Mail}>
          {describeCheckEmail(confirmationEmail)}
        </Banner>
      )}

      <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          type="submit"
          loading={pendingAction === "signIn"}
          loadingLabel="Signing in"
          disabled={isWaiting("signIn")}
        >
          Sign in
        </Button>
        <Button
          type="button"
          variant="secondary"
          loading={pendingAction === "signUp"}
          loadingLabel="Creating account"
          disabled={isWaiting("signUp")}
          onClick={() => {
            void submit("signUp");
          }}
        >
          Create account
        </Button>
      </div>

      <div className="flex items-center gap-3 text-caption text-text-muted">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="secondary"
        loading={pendingAction === "google"}
        loadingLabel="Opening Google"
        disabled={isWaiting("google")}
        onClick={() => {
          void signInWithGoogle();
        }}
        className="gap-3"
      >
        <Image src="/brand/google-g.svg" alt="" width={20} height={20} unoptimized />
        Continue with Google
      </Button>
    </form>
  );
}
