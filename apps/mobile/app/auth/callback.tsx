import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { LinkNotValid } from "../../components/LinkNotValid";
import { SigningInLink } from "../../components/SigningInLink";
import { supabase } from "../../lib/supabase";

import type { EmailOtpType } from "@supabase/supabase-js";

const emailOtpTypes: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function toEmailOtpType(value: string | undefined): EmailOtpType | undefined {
  return emailOtpTypes.find((emailOtpType) => emailOtpType === value);
}

// Whether the link signed the person in. Why it did not is for the server's log and not the screen: the
// board draws one sentence for a link that cannot be used, whatever went wrong with it, including a call
// that threw, so the screen never waits for ever.
async function completeSignIn(
  code: string | undefined,
  tokenHash: string | undefined,
  type: string | undefined,
): Promise<boolean> {
  const emailOtpType = toEmailOtpType(type);

  try {
    if (code !== undefined) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return error === null;
    }

    if (tokenHash !== undefined && emailOtpType !== undefined) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: emailOtpType,
      });
      return error === null;
    }
  } catch {
    return false;
  }

  return false;
}

export default function AuthCallbackRoute() {
  const router = useRouter();
  const {
    code,
    token_hash: tokenHash,
    type,
  } = useLocalSearchParams<{
    code?: string;
    token_hash?: string;
    type?: string;
  }>();
  const [hasFailed, setHasFailed] = useState(false);
  const hasStarted = useRef(false);

  useEffect(() => {
    // A PKCE code works once, so a repeated effect run must not exchange it again.
    if (hasStarted.current) {
      return;
    }
    hasStarted.current = true;

    void completeSignIn(code, tokenHash, type).then((isSignedIn) => {
      if (isSignedIn) {
        router.replace("/(tabs)/dashboard");
      } else {
        setHasFailed(true);
      }
    });
  }, [code, tokenHash, type, router]);

  return hasFailed ? (
    <LinkNotValid
      onBackToSignIn={() => {
        router.replace("/(auth)/sign-in");
      }}
    />
  ) : (
    <SigningInLink />
  );
}
