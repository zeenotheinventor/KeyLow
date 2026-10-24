import { useSetupState } from "@keylow/api-client";
import { useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";

import { useReadsEnabled } from "../../lib/useReadsEnabled";

const FIRST_RUN_SETUP_HREF = "/setup?mode=first-run";

/**
 * Draws nothing. Sends an account that is not set up to the first run of the setup wizard, once per
 * launch and only from the tabs, so a deep link or a modal the person opened is never covered. It fails
 * open: an account that is set up, one with no profile row (which reads as set up), a failed read, a
 * read still under way and offline with nothing cached all leave the app as it is, so nobody is trapped.
 * Nothing is read until the Terms are accepted. A gate is mounted per signed in session, so the next
 * account to sign in during the same launch is sent too. Mount it once, where a person is signed in.
 */
export function SetupGate() {
  const router = useRouter();
  const segments = useSegments();
  const isReadEnabled = useReadsEnabled();
  const setupState = useSetupState({ enabled: isReadEnabled });
  const hasSentToSetup = useRef(false);
  const firstSegment: string | undefined = segments[0];

  // Only a finished read counts. While one runs, the answer in the cache may be another account's, left
  // there when someone signed out and another signed in.
  const isKnownNotSetUp =
    isReadEnabled &&
    !setupState.isError &&
    !setupState.isFetching &&
    setupState.data?.isSetUp === false;

  useEffect(() => {
    if (!isKnownNotSetUp || hasSentToSetup.current || firstSegment !== "(tabs)") {
      return;
    }

    hasSentToSetup.current = true;
    router.replace(FIRST_RUN_SETUP_HREF);
  }, [isKnownNotSetUp, firstSegment, router]);

  return null;
}
