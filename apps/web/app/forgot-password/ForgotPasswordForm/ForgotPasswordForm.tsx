"use client";

import { requestPasswordReset } from "@keylow/api-client";
import { validateEmailAddress } from "@keylow/core/accounts";
import { AUTH_SCREEN, FORGOT_PASSWORD_SCREEN, GENERIC_ERROR } from "@keylow/core/copy";
import { useEffect, useRef, useState, type SubmitEvent } from "react";

import { ResetLinkSent } from "../ResetLinkSent";

import type { SentRequest } from "./types";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthSwitchLink } from "@/components/auth/AuthSwitchLink";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Input";
import { takeForgotPasswordEmail } from "@/lib/auth/forgotPasswordEmail";
import { describeRecoveryRequestedCookie } from "@/lib/auth/recoveryRequestedCookie";
import { reportPasswordResetCode } from "@/lib/auth/reportPasswordResetCode";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentRequest, setSentRequest] = useState<SentRequest | null>(null);
  const [isSending, setIsSending] = useState(false);
  const emailFieldRef = useRef<HTMLInputElement>(null);
  const focusFieldOnReturn = useRef(false);

  // The sign in page leaves the address for one page change. Storage is an external system the server
  // cannot read, so it is read once after the first paint, and reading it removes it. Setting state here
  // is the way to fill the field without a hydration mismatch.
  useEffect(() => {
    const handedOver = takeForgotPasswordEmail();
    if (handedOver !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(handedOver);
    }
  }, []);

  // A resend that fails brings the form back, and focus goes to the field so the error is read with it.
  useEffect(() => {
    if (sentRequest === null && focusFieldOnReturn.current) {
      focusFieldOnReturn.current = false;
      emailFieldRef.current?.focus();
    }
  }, [sentRequest]);

  // Sends the link and shows what came of it. A resend that fails comes back to the form with the address kept.
  async function requestLink(address: string) {
    const isResend = sentRequest !== null;
    setFormError(null);
    setFieldError(undefined);
    setIsSending(true);
    try {
      const outcome = await requestPasswordReset(createClient(), {
        email: address,
        redirectTo: `${window.location.origin}/auth/callback`,
      });

      switch (outcome.kind) {
        case "sent": {
          // The callback reads the time to tell a failed reset link from a failed sign in link.
          document.cookie = describeRecoveryRequestedCookie(
            Date.now(),
            window.location.protocol === "https:",
          );
          if (outcome.unexpectedCode !== undefined) {
            reportPasswordResetCode(outcome.unexpectedCode);
          }
          setSentRequest({ email: address, sentAt: Date.now() });
          break;
        }
        case "invalidEmail":
          focusFieldOnReturn.current = isResend;
          setSentRequest(null);
          setFieldError(outcome.message);
          break;
        case "failed":
          focusFieldOnReturn.current = isResend;
          setSentRequest(null);
          setFormError(outcome.message);
          break;
      }
    } catch {
      focusFieldOnReturn.current = isResend;
      setSentRequest(null);
      setFormError(GENERIC_ERROR);
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const problem = validateEmailAddress(trimmedEmail);
    if (problem !== undefined) {
      setFormError(null);
      setFieldError(problem);
      return;
    }

    void requestLink(trimmedEmail);
  }

  if (sentRequest !== null) {
    return (
      <ResetLinkSent
        email={sentRequest.email}
        sentAt={sentRequest.sentAt}
        isSending={isSending}
        onSendAgain={() => {
          void requestLink(sentRequest.email);
        }}
      />
    );
  }

  return (
    <AuthCard heading={FORGOT_PASSWORD_SCREEN.heading} caption={FORGOT_PASSWORD_SCREEN.body}>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label={AUTH_SCREEN.emailLabel}
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          error={fieldError}
          ref={emailFieldRef}
        />

        {formError !== null && <Banner tone="error">{formError}</Banner>}

        <Button
          type="submit"
          className="mt-1"
          loading={isSending}
          loadingLabel={FORGOT_PASSWORD_SCREEN.submittingLabel}
        >
          {FORGOT_PASSWORD_SCREEN.submitLabel}
        </Button>
      </form>
      <AuthSwitchLink
        prompt={FORGOT_PASSWORD_SCREEN.footerPrompt}
        linkLabel={FORGOT_PASSWORD_SCREEN.footerLink}
        href="/login"
        variant="centred"
      />
    </AuthCard>
  );
}
