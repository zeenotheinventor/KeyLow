import { authLinkDestination } from "@keylow/core/accounts";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { LinkNotValid } from "../../components/LinkNotValid";
import { SigningInLink } from "../../components/SigningInLink";
import { completeAuthLink } from "../../lib/authLink";
import { clearRecoveryRequest, readRecoveryRequestedAt } from "../../lib/recoveryRequest";

import type { AuthLinkDestination, AuthLinkResult } from "@keylow/core/accounts";

async function destinationOf(result: AuthLinkResult): Promise<AuthLinkDestination> {
  if (result.kind === "recovery") {
    await clearRecoveryRequest();
  }

  const recoveryRequestedAt = result.kind === "failed" ? await readRecoveryRequestedAt() : null;

  return authLinkDestination({ result, recoveryRequestedAt, now: Date.now() });
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

    void completeAuthLink({ code, tokenHash, type })
      .then(destinationOf)
      .then((destination) => {
        switch (destination) {
          case "home":
            router.replace("/(tabs)/dashboard");
            break;
          // The two cases below are interim: a reset link signs the person in and opens the dashboard, and a
          // failed reset link shows the ordinary link error. The set new password and reset link error
          // screens each replace one line.
          case "setNewPassword":
            router.replace("/(tabs)/dashboard");
            break;
          case "resetLinkInvalid":
            setHasFailed(true);
            break;
          case "signInLinkInvalid":
            setHasFailed(true);
            break;
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
