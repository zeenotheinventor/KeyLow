"use client";

import { useSetupState } from "@keylow/api-client";
import { useState } from "react";

/** The read failed and has not come back yet. The banner is drawn from this. */
export type SetupReadFailure = Readonly<{
  /** A retry is running. The banner stays where it is and its action is off until it settles. */
  isRetrying: boolean;
  retry: () => void;
}>;

/**
 * The saved answers for the wizard, as the screen needs to treat them. The skeleton is for the first read
 * only: it waits while a request is running, which a failing read retries a few times first, and never
 * comes back once the steps have opened, so a retry cannot take the page from under the person's typing.
 * A read paused because the browser is offline does not wait, so the steps open at once.
 *
 * A failure is remembered. The banner does not key off `isError`, because a retry with no data puts the
 * query back to pending, where `isError` is false until it settles. It stays while the data is missing
 * and goes when the data arrives.
 */
export function useSetupRead() {
  const setupState = useSetupState();
  const [hasOpened, setHasOpened] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const isRequestRunning = setupState.isPending && setupState.fetchStatus === "fetching";

  if (!hasOpened && !isRequestRunning) {
    setHasOpened(true);
  }
  if (setupState.isError && setupState.data === undefined && !hasFailed) {
    setHasFailed(true);
  }
  if (setupState.data !== undefined && hasFailed) {
    setHasFailed(false);
  }

  const failure: SetupReadFailure | undefined =
    setupState.data === undefined && hasFailed
      ? {
          isRetrying: setupState.fetchStatus === "fetching",
          retry: () => {
            void setupState.refetch();
          },
        }
      : undefined;

  return {
    setupState: setupState.data,
    /** True only until the first read has ended, errored or paused. */
    isWaiting: !hasOpened && isRequestRunning,
    /** True once the steps have opened, whether or not the read gave anything. */
    hasOpened: hasOpened || !isRequestRunning,
    failure,
  };
}
