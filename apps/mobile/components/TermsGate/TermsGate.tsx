import { keys, useTermsAcceptance } from "@keylow/api-client";
import { GENERIC_ERROR, RETRY_LABEL, TERMS_VERSION } from "@keylow/core/copy";
import { needsTermsAcceptance } from "@keylow/core/terms";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { useIsTermsGateHeld } from "../../lib/termsGateHold";
import { AcceptTermsScreen } from "../AcceptTermsScreen";
import { SessionCover } from "../SessionCover";
import { SignOutButton } from "../SignOutButton";
import { ErrorState } from "../ui";

import type { TermsGateProps, TermsGateState } from "./types";

/** How long the loading mark shows alone before Sign out appears under it, so a stall is never a dead end. */
const SIGN_OUT_DELAY_MS = 3000;

// react-query retries three times with a growing delay, about seven seconds before a read counts as failed.
// While the gate loads, a native modal can sit above its cover on iOS, so a failed read is called after one
// short retry. The hook takes no options, so the cache's per-query defaults carry them.
const READ_RETRY_COUNT = 1;
const READ_RETRY_DELAY_MS = 500;

function LoadingCover() {
  const [isSignOutShown, setIsSignOutShown] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSignOutShown(true);
    }, SIGN_OUT_DELAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <SessionCover />
      {isSignOutShown ? (
        <View className="absolute inset-x-0 bottom-0 px-6 pb-[34px]">
          <SignOutButton />
        </View>
      ) : null}
    </>
  );
}

/**
 * The accept-to-continue gate for a signed in user, drawn over the app. It fails closed: while the
 * acceptance is loading, or a Google sign-up is still recording it, only the Ki-Lo mark shows, with Sign
 * out under it once the wait passes a few seconds. A failed
 * read shows a fixed sentence with a retry and Sign out, never the error. An account with no current
 * acceptance gets the accept screen. Only an account whose acceptance is current gets nothing drawn over
 * the app. The query lives here, so it runs only while someone is signed in.
 */
export function TermsGate({ onStateChange }: TermsGateProps) {
  const isHeld = useIsTermsGateHeld();
  const queryClient = useQueryClient();
  // Set before the hook builds its query, and the same every time, so it runs once.
  useState(() => {
    queryClient.setQueryDefaults(keys.profiles.termsAcceptance, {
      retry: READ_RETRY_COUNT,
      retryDelay: READ_RETRY_DELAY_MS,
    });
  });
  const acceptance = useTermsAcceptance();

  // An acceptance that is already known stays the answer when a refetch fails (the app refetches it on
  // every return to the foreground), so only a read that never produced one counts as an error.
  const isAcceptanceUnknown = acceptance.data === undefined;
  const state = toTermsGateState({
    isHeld,
    isPending: acceptance.isPending,
    isError: acceptance.isError && isAcceptanceUnknown,
    isFetching: acceptance.isFetching && isAcceptanceUnknown,
    needsAcceptance: needsTermsAcceptance(acceptance.data ?? null, TERMS_VERSION),
  });
  useEffect(() => {
    onStateChange(state);

    return () => {
      onStateChange("open");
    };
  }, [state, onStateChange]);

  if (state === "loading") {
    return <LoadingCover />;
  }

  if (state === "failed") {
    return (
      <View className="absolute inset-0 bg-background pb-[34px]">
        <ErrorState
          retry={{
            label: RETRY_LABEL,
            onPress: () => {
              void acceptance.refetch();
            },
          }}
          title={GENERIC_ERROR}
        />
        <View className="px-6">
          <SignOutButton />
        </View>
      </View>
    );
  }

  if (state === "accept") {
    return (
      <View className="absolute inset-0 bg-background">
        <AcceptTermsScreen />
      </View>
    );
  }

  return null;
}

type GateInputs = {
  isHeld: boolean;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  needsAcceptance: boolean;
};

// An error that is being retried reads as loading, so the retry shows it is working.
function toTermsGateState({
  isHeld,
  isPending,
  isError,
  isFetching,
  needsAcceptance,
}: GateInputs): TermsGateState {
  if (isHeld || isPending || (isError && isFetching)) {
    return "loading";
  }

  if (isError) {
    return "failed";
  }

  return needsAcceptance ? "accept" : "open";
}
