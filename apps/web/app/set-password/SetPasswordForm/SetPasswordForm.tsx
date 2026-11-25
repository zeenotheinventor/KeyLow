"use client";

import { updatePassword } from "@keylow/api-client";
import { PASSWORD_SAVED, SET_PASSWORD_SCREEN, describePasswordFor } from "@keylow/core/copy";
import { captureException } from "@sentry/nextjs";
import { CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { SetPasswordFormProps } from "./types";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthMessageCard } from "@/components/auth/AuthMessageCard";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { endSession } from "@/lib/auth/endSession";
import { removeStoredSession } from "@/lib/auth/storedSession";
import { createClient } from "@/lib/supabase/client";

const DASHBOARD_PATH = "/dashboard";
const FORGOT_PASSWORD_PATH = "/forgot-password";

/**
 * Where a reset link lands. The link has already signed the person in, so saving only needs the new
 * password. Leaving without saving keeps the old password. A reset that has timed out offers a new link,
 * which first ends the session here, as the forgot password page is closed to a signed in person.
 */
export function SetPasswordForm({ email }: SetPasswordFormProps) {
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(false);
  const savedTitleRef = useRef<HTMLHeadingElement>(null);

  // The form is replaced by the saved message, so the title takes focus rather than the page body.
  useEffect(() => {
    if (isSaved) {
      savedTitleRef.current?.focus();
    }
  }, [isSaved]);

  async function sendNewLink() {
    try {
      await endSession(createClient().auth, removeStoredSession);
    } catch (error) {
      // The person stays on the page with the sentence still showing, and Sentry sees the failure.
      captureException(error);
      return;
    }
    router.replace(FORGOT_PASSWORD_PATH);
  }

  if (isSaved) {
    return (
      <AuthCard>
        <AuthMessageCard
          tone="success"
          icon={CircleCheck}
          titleRef={savedTitleRef}
          title={PASSWORD_SAVED.title}
          body={PASSWORD_SAVED.body}
          primaryAction={{ label: PASSWORD_SAVED.continueLabel, href: DASHBOARD_PATH }}
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard heading={SET_PASSWORD_SCREEN.heading} caption={describePasswordFor(email)}>
      <NewPasswordForm
        copy={SET_PASSWORD_SCREEN}
        onSave={(newPassword) =>
          updatePassword(createClient(), { newPassword, context: "recovery" })
        }
        onSaved={() => {
          setIsSaved(true);
        }}
        onSendNewLink={() => {
          void sendNewLink();
        }}
      />
    </AuthCard>
  );
}
