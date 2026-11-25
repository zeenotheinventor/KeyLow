import { useRequestPasswordReset } from "@keylow/api-client";
import { resendSecondsLeft, validateEmailAddress } from "@keylow/core/accounts";
import { useEffect, useState } from "react";

import { AUTH_CALLBACK_URL } from "../../lib/authLink";
import { takeForgotPasswordEmail } from "../../lib/forgotPasswordEmail";
import { recordRecoveryRequest } from "../../lib/recoveryRequest";
import { reportPasswordResetCode } from "../../lib/sentry/reportPasswordResetCode";

import type { PasswordResetRequestOutcome } from "@keylow/core/accounts";

type Sent = { email: string; at: number };

/**
 * What the forgot password screen knows: the field, the problem under it, the failure above the button, and
 * once a link was sent, to whom and when. Sending again asks for the same address, and a resend that fails
 * returns to the form with the address kept, because the sent screen has no place to say so. The address
 * never leaves this hook except to the request itself.
 */
export function useForgotPassword() {
  const [email, setEmail] = useState(takeForgotPasswordEmail);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const [sent, setSent] = useState<Sent | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const request = useRequestPasswordReset();

  const secondsLeft = sent === undefined ? 0 : resendSecondsLeft(sent.at, now);
  const isCountingDown = secondsLeft > 0;

  useEffect(() => {
    if (!isCountingDown) {
      return undefined;
    }
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [isCountingDown]);

  function handleOutcome(outcome: PasswordResetRequestOutcome, address: string) {
    switch (outcome.kind) {
      case "sent": {
        void recordRecoveryRequest();
        if (outcome.unexpectedCode !== undefined) {
          reportPasswordResetCode(outcome.unexpectedCode);
        }
        const sentAt = Date.now();
        setNow(sentAt);
        setSent({ email: address, at: sentAt });
        break;
      }
      case "invalidEmail":
        setSent(undefined);
        setFieldError(outcome.message);
        break;
      case "failed":
        setSent(undefined);
        setFailure(outcome.message);
        break;
    }
  }

  async function send(address: string) {
    const problem = validateEmailAddress(address);
    setFieldError(problem);
    setFailure(undefined);
    if (problem !== undefined) {
      return;
    }

    const trimmed = address.trim();
    // Awaited here and not handled by a per-call callback, which is dropped once the screen is gone, so a
    // link that was sent still leaves its marker when the person went back while it was on its way.
    const outcome = await request.mutateAsync({ email: trimmed, redirectTo: AUTH_CALLBACK_URL });
    handleOutcome(outcome, trimmed);
  }

  return {
    email,
    setEmail,
    fieldError,
    failure,
    isSending: request.isPending,
    sentTo: sent?.email,
    secondsLeft,
    send: () => {
      void send(email);
    },
    sendAgain: () => {
      if (sent !== undefined) {
        void send(sent.email);
      }
    },
  };
}
