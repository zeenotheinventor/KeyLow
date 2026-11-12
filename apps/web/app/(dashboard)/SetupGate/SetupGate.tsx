"use client";

import { useSetupState } from "@keylow/api-client";
import { shouldSendToSetup } from "@keylow/core/setup";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { isFirstRunSection, isSetupWizardPath } from "./firstRunSections";

import { setupPath } from "@/lib/setupRoutes";

/**
 * Draws nothing. Sends an account that is not set up to the first run of the setup wizard, at most once per page
 * load (the ref lives as long as the mounted layout, so moving about the app does not send them again and a reload
 * may) and only from the four sections' own addresses, so a deep link is never covered. The decision is core's
 * `shouldSendToSetup`, shared with the phone's gate: it fails open, so an account that is set up, one with no profile
 * row (which reads as set up), a failed read, a read still under way and offline with nothing cached all leave the
 * page as it is. Only a finished read counts, since the cache may hold another account's answer just after a sign
 * out. A person who has been on the wizard is not sent either, whether they finished it or left it for the Diary.
 * The layout has passed the Terms gate, and it unmounts on the way to /login, so the next account to sign in in
 * the same tab gets a new cache and a new gate. Mount it once, where a person is signed in.
 */
export function SetupGate() {
  const router = useRouter();
  const pathname = usePathname();
  const setupState = useSetupState();
  const isDone = useRef(false);

  const isKnownNotSetUp = shouldSendToSetup({
    isError: setupState.isError,
    isFetching: setupState.isFetching,
    isSetUp: setupState.data?.isSetUp,
  });

  useEffect(() => {
    if (isSetupWizardPath(pathname)) {
      isDone.current = true;
      return;
    }
    if (!isKnownNotSetUp || isDone.current || !isFirstRunSection(pathname)) {
      return;
    }

    isDone.current = true;
    // A replace, so the browser's Back does not return to a page that sends them again.
    router.replace(setupPath("sex", "first-run"));
  }, [isKnownNotSetUp, pathname, router]);

  return null;
}
