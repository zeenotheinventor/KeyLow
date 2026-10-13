import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

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

async function completeSignIn(
  code: string | undefined,
  tokenHash: string | undefined,
  type: string | undefined,
): Promise<string | null> {
  const emailOtpType = toEmailOtpType(type);

  if (code !== undefined) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error?.message ?? null;
  }

  if (tokenHash !== undefined && emailOtpType !== undefined) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: emailOtpType });
    return error?.message ?? null;
  }

  return "This sign-in link is not valid";
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    // A PKCE code works once, so a repeated effect run must not exchange it again.
    if (hasStarted.current) {
      return;
    }
    hasStarted.current = true;

    void completeSignIn(code, tokenHash, type).then((message) => {
      if (message === null) {
        router.replace("/(tabs)/diary");
      } else {
        setErrorMessage(message);
      }
    });
  }, [code, tokenHash, type, router]);

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-legacy-neutral-50 px-6">
      {errorMessage === null ? (
        <Text accessibilityLiveRegion="polite" className="text-base text-legacy-neutral-500">
          Signing you in
        </Text>
      ) : (
        <>
          <Text accessibilityRole="alert" className="text-base text-legacy-danger-600">
            {errorMessage}
          </Text>
          <Link
            href="/(auth)/sign-in"
            className="py-3 text-base font-semibold text-legacy-brand-600"
          >
            Back to sign in
          </Link>
        </>
      )}
    </View>
  );
}
