import { AUTH_SCREEN, DELETE_ACCOUNT_COPY } from "@keylow/core/copy";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { AuthForm } from "../../components/AuthForm";
import { Banner } from "../../components/ui";
import {
  hasAccountDeletedNotice,
  subscribeToAccountDeletedNotice,
  takeAccountDeletedNotice,
} from "../../lib/accountDeletion/accountDeletedNotice";
import { authErrorCode } from "../../lib/authErrorCode";
import { supabase } from "../../lib/supabase";

import type { AuthFormOutcome } from "../../components/AuthForm";
import type { Credentials } from "../../lib/validateCredentials";

async function signIn(credentials: Credentials): Promise<AuthFormOutcome> {
  const { error } = await supabase.auth.signInWithPassword(credentials);

  return error === null ? { status: "done" } : { status: "error", code: authErrorCode(error) };
}

// Whether to say the account was deleted. The signal is read when the screen shows, and again if it arrives later
// (the start-up runner can announce after Sign in is already up). It is used up when the screen goes out of focus,
// which covers signing in, opening Create account (which leaves this screen mounted under it) and leaving, so the
// confirmation is said once. It lives in memory only, so it never shows on the next start.
function useAccountDeletedNotice(): boolean {
  const [isShown, setIsShown] = useState(hasAccountDeletedNotice);

  useFocusEffect(
    useCallback(() => {
      function showIfWaiting() {
        if (hasAccountDeletedNotice()) {
          setIsShown(true);
        }
      }
      showIfWaiting();
      const unsubscribe = subscribeToAccountDeletedNotice(showIfWaiting);

      return () => {
        unsubscribe();
        takeAccountDeletedNotice();
        setIsShown(false);
      };
    }, []),
  );

  return isShown;
}

export default function SignInRoute() {
  const isAccountDeleted = useAccountDeletedNotice();

  return (
    <AuthForm
      notice={
        isAccountDeleted ? (
          <Banner sentence title={DELETE_ACCOUNT_COPY.signInNotice} variant="success" />
        ) : undefined
      }
      heading={AUTH_SCREEN.signIn.heading}
      submitLabel={AUTH_SCREEN.signIn.submitLabel}
      passwordRule="required"
      onSubmit={signIn}
      footer={{
        prompt: AUTH_SCREEN.signIn.footerPrompt,
        linkLabel: AUTH_SCREEN.signIn.footerLink,
        href: "/(auth)/sign-up",
      }}
    />
  );
}
