"use client";

import { useSetupDraft } from "@keylow/api-client";
import { toLocalDate } from "@keylow/core/dates";
import { entryWeightUnit } from "@keylow/core/setup";
import { useMemo } from "react";

import { regionOfLanguage } from "./regionOfLanguage";
import { SetupFlowContext } from "./setupFlowContext";
import { SetupScreenSkeleton } from "../SetupScreenSkeleton";
import { timeZoneOrDevice } from "../timeZoneOrDevice";
import { useSetupRead } from "../useSetupRead";

import type { SetupFlowProps } from "./types";

import { useNow } from "@/lib/useNow";

/**
 * Holds the answers for every address under /setup. The reducer lives here, above the skeleton and the
 * read's failure, so Back loses none, a retry cannot unmount it and a refetch never writes over what was
 * typed: the saved answers join once. Leaving the wizard drops the answers, and nothing is stored or
 * logged. The terms gate is in the dashboard layout, so the read is always on.
 */
export function SetupFlow({ children }: SetupFlowProps) {
  const read = useSetupRead();
  const today = toLocalDate(useNow(), timeZoneOrDevice());
  const regionCode = useMemo(
    () => (typeof navigator === "undefined" ? undefined : regionOfLanguage(navigator.language)),
    [],
  );
  const { state, dispatch } = useSetupDraft(read.setupState, today, regionCode);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      today,
      weightUnit:
        state.draft.weightUnit ??
        entryWeightUnit(read.setupState?.stats.weightUnit ?? null, regionCode),
      // Paused offline or failed with nothing to come, or the answers have joined.
      isAddressJudgeable:
        state.hasLoadedSavedAnswers || (read.hasOpened && read.setupState === undefined),
      setupState: read.setupState,
      readFailure: read.failure,
    }),
    [state, dispatch, today, read.setupState, read.hasOpened, read.failure, regionCode],
  );

  if (read.isWaiting) {
    return <SetupScreenSkeleton />;
  }

  return <SetupFlowContext.Provider value={value}>{children}</SetupFlowContext.Provider>;
}
