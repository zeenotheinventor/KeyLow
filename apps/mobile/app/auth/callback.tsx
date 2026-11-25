import { authLinkDestination } from "@keylow/core/accounts";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { LinkNotValid } from "../../components/LinkNotValid";
import { ResetLinkNotValid } from "../../components/ResetLinkNotValid";
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
  const [failure, setFailure] = useState<"resetLink" | "signInLink" | undefined>(undefined);
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
          // Interim: a reset link signs the person in and opens the dashboard. The set new password screen
          // replaces this line.
          case "setNewPassword":
            router.replace("/(tabs)/dashboard");
            break;
          case "resetLinkInvalid":
            setFailure("resetLink");
            break;
          case "signInLinkInvalid":
            setFailure("signInLink");
            break;
        }
      });
  }, [code, tokenHash, type, router]);

  if (failure === "resetLink") {
    return (
      <ResetLinkNotValid
        onBackToSignIn={() => {
          router.replace("/(auth)/sign-in");
        }}
        onSendNewLink={() => {
          router.replace("/(auth)/forgot-password");
        }}
      />
    );
  }

  return failure === "signInLink" ? (
    <LinkNotValid
      onBackToSignIn={() => {
        router.replace("/(auth)/sign-in");
      }}
    />
  ) : (
    <SigningInLink />
  );
}
