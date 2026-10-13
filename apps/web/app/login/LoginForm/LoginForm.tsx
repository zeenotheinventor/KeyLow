"use client";

import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";

import type { FieldErrors, LoginFormProps } from "./types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const PASSWORD_MIN_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONFIRM_EMAIL_NOTICE = "Check your email to confirm your account";
const UNEXPECTED_ERROR_MESSAGE = "Something went wrong. Please try again.";

type Action = "signIn" | "signUp";

function validate(email: string, password: string, action: Action): FieldErrors {
  const errors: FieldErrors = {};

  if (email === "") {
    errors.email = "Enter your email address";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address";
  }

  // Sign-in only needs a password, because accounts made under a shorter minimum must still work.
  if (password === "") {
    errors.password = "Enter your password";
  } else if (action === "signUp" && password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Password must be at least ${String(PASSWORD_MIN_LENGTH)} characters`;
  }

  return errors;
}

export function LoginForm({ linkError }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(linkError ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function openDiary() {
    router.push("/diary");
    router.refresh();
  }

  async function runPending(request: () => Promise<void>) {
    setIsPending(true);
    try {
      await request();
    } catch {
      setFormError(UNEXPECTED_ERROR_MESSAGE);
    } finally {
      setIsPending(false);
    }
  }

  async function submit(action: Action) {
    const trimmedEmail = email.trim();
    const errors = validate(trimmedEmail, password, action);

    setFormError(null);
    setNotice(null);
    setFieldErrors(errors);
    if (errors.email !== undefined || errors.password !== undefined) {
      return;
    }

    await runPending(async () => {
      const supabase = createClient();

      if (action === "signIn") {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) {
          setFormError(error.message);
        } else {
          openDiary();
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) {
          setFormError(error.message);
        } else if (data.session) {
          openDiary();
        } else {
          setNotice(CONFIRM_EMAIL_NOTICE);
        }
      }
    });
  }

  async function signInWithGoogle() {
    setFormError(null);
    setNotice(null);

    await runPending(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setFormError(error.message);
      }
    });
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit("signIn");
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          aria-invalid={fieldErrors.email !== undefined}
          aria-describedby={fieldErrors.email === undefined ? undefined : "email-error"}
        />
        {fieldErrors.email !== undefined && (
          <p id="email-error" className="text-sm text-danger">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          aria-invalid={fieldErrors.password !== undefined}
          aria-describedby={fieldErrors.password === undefined ? undefined : "password-error"}
        />
        {fieldErrors.password !== undefined && (
          <p id="password-error" className="text-sm text-danger">
            {fieldErrors.password}
          </p>
        )}
      </div>

      {formError !== null && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}
      {notice !== null && (
        <p role="status" className="text-sm text-text-muted">
          {notice}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={isPending} className="h-11 flex-1 md:h-9">
          Sign in
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            void submit("signUp");
          }}
          className="h-11 flex-1 md:h-9"
        >
          Create account
        </Button>
      </div>

      <div className="flex flex-col gap-1.5 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            void signInWithGoogle();
          }}
          className="h-11 md:h-9"
        >
          Continue with Google
        </Button>
      </div>
    </form>
  );
}
