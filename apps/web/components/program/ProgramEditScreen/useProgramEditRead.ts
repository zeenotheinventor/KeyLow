"use client";

import {
  useExpenditureHistory,
  useProfileTimeZone,
  useProgramSummary,
  useSetupState,
  useWeightTrend,
  useWeightUnit,
} from "@keylow/api-client";
import { toLocalDate } from "@keylow/core/dates";
import {
  newestExpenditureKcal,
  programEditAgeYears,
  programEditWeightKg,
} from "@keylow/core/program";
import { useState } from "react";

import type { ProgramEditFormProps } from "./ProgramEditForm";

import { useIsOnline } from "@/lib/useIsOnline";

// How far back the expenditure history is read, a year of weekly check-ins, as the setup recalculation reads it.
// Its newest snapshot is the one a recompute keeps, whichever programme made it.
const EXPENDITURE_HISTORY_WEEKS = 52;

/** What Edit programme draws from its reads. */
export type ProgramEditRead =
  | { status: "loading" }
  /** `retry` is absent while nothing can be read for want of a connection, where trying again would do nothing. */
  | { status: "error"; retry: (() => void) | undefined }
  | { status: "no-program" }
  | { status: "ready"; form: ProgramEditFormProps };

/**
 * What Edit programme reads, as one state. The form needs the programme, the saved setup (birth date and latest
 * weigh-in) and the weight unit, which are the three that can fail it. The time zone and the weight trend are
 * waited for and never fail it, and the expenditure history only fills the footnote, so it never holds the form
 * back.
 *
 * Every state is told by the data being there, never by `isError`: a background refetch that fails keeps what was
 * read. The web has no persisted cache and a read pauses offline, so with nothing read and no connection the answer
 * is the error with no retry, and never the skeleton.
 */
function useProgramEditReads(now: Date): ProgramEditRead {
  const isOnline = useIsOnline();
  const summary = useProgramSummary();
  const setupState = useSetupState();
  const weightUnit = useWeightUnit();
  const timeZone = useProfileTimeZone();
  const weightTrend = useWeightTrend();
  const expenditureHistory = useExpenditureHistory({ weeks: EXPENDITURE_HISTORY_WEEKS });

  if (
    summary.data === undefined ||
    setupState.data === undefined ||
    weightUnit.data === undefined
  ) {
    const reads = [summary, setupState, weightUnit];
    const isFailed = reads.some((read) => read.data === undefined && read.isError);
    const isPaused =
      !isOnline || reads.some((read) => read.data === undefined && read.fetchStatus === "paused");

    if (isPaused) {
      return { status: "error", retry: undefined };
    }
    return isFailed
      ? {
          status: "error",
          retry: () => {
            for (const read of reads) {
              void read.refetch();
            }
          },
        }
      : { status: "loading" };
  }

  const { program } = summary.data;
  if (program === null) {
    return { status: "no-program" };
  }
  // The zone and the trend are waited for, except offline, where a read cannot arrive and the day reads as UTC.
  if ((timeZone.isPending && isOnline) || weightTrend.isLoading) {
    return { status: "loading" };
  }

  const weightKg = programEditWeightKg({
    trendKg: weightTrend.points.at(-1)?.trendKg,
    latestWeighInKg: setupState.data.latestWeighIn?.weightKg,
    currentTargetsKg: summary.data.currentTargets?.basis.trendWeightKg,
  });
  if (weightKg === undefined) {
    // Nothing to work the values out at. Reading again is the one thing that can change it.
    return {
      status: "error",
      retry: isOnline
        ? () => {
            void summary.refetch();
            void setupState.refetch();
          }
        : undefined,
    };
  }

  // If the zone cannot be read the day is UTC, as the other screens read it.
  const today = toLocalDate(now, timeZone.data ?? "UTC");

  return {
    status: "ready",
    form: {
      program,
      ageYears: programEditAgeYears(setupState.data.stats.birthDate ?? null, today),
      weightKg,
      weightUnit: weightUnit.data,
      expenditureKcal: newestExpenditureKcal(expenditureHistory.data),
      today,
    },
  };
}

/**
 * What Edit programme draws, which stays the form once it has been drawn. A save drops the program and targets
 * reads from the cache so the next screen reads fresh, and the reads this form still holds then start again
 * with nothing in them. The form it has drawn must not turn back into a skeleton, and lose the choices on it,
 * in the moment before the page goes.
 */
export function useProgramEditRead(now: Date): ProgramEditRead {
  const read = useProgramEditReads(now);
  const [heldForm, setHeldForm] = useState<ProgramEditFormProps | null>(null);

  if (read.status === "ready") {
    if (heldForm === null) {
      setHeldForm(read.form);
    }
    return read;
  }
  // A programme that ended elsewhere is a read answer and not a missing read, so it goes through to the redirect.
  if (read.status === "no-program") {
    return read;
  }
  return heldForm === null ? read : { status: "ready", form: heldForm };
}
