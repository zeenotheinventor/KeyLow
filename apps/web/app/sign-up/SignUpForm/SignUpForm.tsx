"use client";

import {
  CHECK_EMAIL_TITLE,
  GENERIC_ERROR,
  SIGN_UP_SCREEN,
  TERMS_VERSION,
  describeCheckEmail,
} from "@keylow/core/copy";
import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";

import type { PendingAction } from "./types";

import { AcceptanceCheckbox } from "@/components/auth/AcceptanceCheckbox";
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
import {
  describeClearedTermsPendingCookie,
  describeTermsPendingCookie,
} from "@/lib/auth/termsPendingCookie";
import { createClient } from "@/lib/supabase/client";

export function SignUpForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasAccepted, setHasAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
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

  // A tick left for a Google attempt must not outlive a choice to use the email form, or the box.
  const clearGoogleAcceptance = () => {
    document.cookie = describeClearedTermsPendingCookie();
  };

  async function signUp() {
    clearGoogleAcceptance();
    const trimmedEmail = email.trim();
    const errors = validateCredentials(trimmedEmail, password, { enforcePasswordLength: true });

    setFormError(null);
    setConfirmationEmail(null);
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) {
      return;
    }

    await runPending("signUp", async () => {
      // The database records the acceptance from this metadata when it creates the profile.
      const { data, error } = await createClient().auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { terms_version: TERMS_VERSION },
        },
      });
      if (error) {
        setFormError(describeFailure(error));
      } else if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setConfirmationEmail(trimmedEmail);
      }
    });
  }

  async function signUpWithGoogle() {
    setFormError(null);
    setConfirmationEmail(null);
    // The callback route reads this after Google sends the person back, and records the acceptance.
    document.cookie = describeTermsPendingCookie(window.location.protocol === "https:");

    await runPending("google", async () => {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        clearGoogleAcceptance();
        setFormError(describeFailure(error));
      }
    });
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasAccepted) {
      void signUp();
    }
  }

  // The button that is running shows its spinner at full strength. The other is dimmed and waits.
  const isWaiting = (action: PendingAction) => pendingAction !== null && pendingAction !== action;

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
      <GoogleButton
        loading={pendingAction === "google"}
        disabled={!hasAccepted || isWaiting("google")}
        onClick={() => {
          void signUpWithGoogle();
        }}
      />

      <OrDivider />

      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder={SIGN_UP_SCREEN.emailPlaceholder}
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
        autoComplete="new-password"
        placeholder={SIGN_UP_SCREEN.passwordPlaceholder}
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
        }}
        error={fieldErrors.password}
      />

      <AcceptanceCheckbox
        checked={hasAccepted}
        onCheckedChange={(checked) => {
          if (!checked) {
            clearGoogleAcceptance();
          }
          setHasAccepted(checked);
        }}
      />

      {formError !== null && <Banner tone="error">{formError}</Banner>}
      {confirmationEmail !== null && (
        <Banner title={CHECK_EMAIL_TITLE} icon={Mail}>
          {describeCheckEmail(confirmationEmail)}
        </Banner>
      )}

      <Button
        type="submit"
        loading={pendingAction === "signUp"}
        loadingLabel="Creating account"
        disabled={!hasAccepted || isWaiting("signUp")}
      >
        {SIGN_UP_SCREEN.submitLabel}
      </Button>
    </form>
  );
}
