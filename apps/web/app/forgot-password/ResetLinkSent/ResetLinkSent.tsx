"use client";

import { resendSecondsLeft } from "@keylow/core/accounts";
import {
  RESET_LINK_SENT_SCREEN,
  describeResetLinkSent,
  describeSendAgainCountdown,
} from "@keylow/core/copy";
import { Mail } from "lucide-react";
import { useEffect, useRef } from "react";

import type { ResetLinkSentProps } from "./types";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthMessageCard } from "@/components/auth/AuthMessageCard";
import { Button } from "@/components/ui/Button";
import { useNow } from "@/lib/useNow";

export function ResetLinkSent({ email, sentAt, isSending, onSendAgain }: ResetLinkSentProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const now = useNow(1000);
  const secondsLeft = resendSecondsLeft(sentAt, now.getTime());
  const isLocked = secondsLeft > 0;

  // The page replaced the form, and a send again replaces the sentence, so the title takes focus each time.
  useEffect(() => {
    titleRef.current?.focus();
  }, [sentAt]);

  return (
    <AuthCard>
      <AuthMessageCard
        tone="neutral"
        icon={Mail}
        titleRef={titleRef}
        title={RESET_LINK_SENT_SCREEN.heading}
        body={describeResetLinkSent(email, "browser")}
        secondaryAction={{ label: RESET_LINK_SENT_SCREEN.backToSignInLabel, href: "/login" }}
        footer={
          <>
            <p className="mt-2 text-caption text-text-secondary">
              {RESET_LINK_SENT_SCREEN.spamHint}
            </p>
            <Button
              type="button"
              variant="ghost"
              disabled={isLocked}
              loading={isSending}
              loadingLabel={RESET_LINK_SENT_SCREEN.sendAgainLabel}
              onClick={onSendAgain}
            >
              {isLocked
                ? describeSendAgainCountdown(secondsLeft)
                : RESET_LINK_SENT_SCREEN.sendAgainLabel}
            </Button>
          </>
        }
      />
    </AuthCard>
  );
}
