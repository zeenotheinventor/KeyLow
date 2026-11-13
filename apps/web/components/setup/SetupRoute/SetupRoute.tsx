"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useSetupFlow } from "../SetupFlow";
import { SetupScreen } from "../SetupScreen";

import type { SetupRouteProps } from "./types";
import type { SetupMode } from "@/lib/setupRoutes";

import { diaryHref } from "@/lib/diary";
import {
  readSetupStep,
  setupExitPath,
  setupPath,
  stepToRedirectTo,
  wasRecalculationSaved,
} from "@/lib/setupRoutes";

/**
 * A step's address. The address is the source of truth: the reducer is told of the step with `stepOpened` when
 * the address is on show, on arrival and on the browser's Back. The reducer accepts any step, so this is where
 * a finished wizard's address is sent on (see `finishedAddressOf`), and an address is stopped: one whose
 * earlier steps are unanswered, such as the estimate on an empty draft, is replaced by the first incomplete
 * step, and so is anything that is not a step. It waits until the saved
 * answers have joined or the read has ended, so a recalculation is not sent back before its answers arrive.
 * Nothing is drawn while the person is being sent on, and a screen that has been drawn stays, so a late
 * answer cannot take the page from under what is being typed.
 */
export function SetupRoute({ segment, mode }: SetupRouteProps) {
  const router = useRouter();
  const { state, dispatch, today, isAddressJudgeable, setupState } = useSetupFlow();
  const step = segment === undefined ? "sex" : readSetupStep(segment);
  const redirectTo =
    step === undefined
      ? "sex"
      : isAddressJudgeable
        ? stepToRedirectTo(state.draft, step, today)
        : undefined;
  const [isShown, setIsShown] = useState(false);
  const leaveFor = isShown ? undefined : finishedAddressOf(mode, setupState?.isSetUp);
  if (
    !isShown &&
    isAddressJudgeable &&
    step !== undefined &&
    redirectTo === undefined &&
    leaveFor === undefined
  ) {
    setIsShown(true);
  }
  const stepOnShow =
    isShown && redirectTo === undefined && leaveFor === undefined ? step : undefined;

  useEffect(() => {
    if (leaveFor !== undefined) {
      router.replace(leaveFor);
    }
  }, [leaveFor, router]);

  useEffect(() => {
    if (redirectTo !== undefined && leaveFor === undefined) {
      router.replace(setupPath(redirectTo, mode));
    }
  }, [redirectTo, leaveFor, mode, router]);

  useEffect(() => {
    if (stepOnShow !== undefined) {
      dispatch({ type: "stepOpened", step: stepOnShow });
    }
  }, [stepOnShow, dispatch]);

  return stepOnShow === undefined ? null : <SetupScreen step={stepOnShow} mode={mode} />;
}

/**
 * Where an address opened on a finished wizard goes instead, or `undefined` when the wizard is still open. The
 * web cannot drop history entries, so the browser's Back after the end lands on a step. The first run of an
 * account that is set up goes to the Diary on today, as the phone replaces the wizard with it, and a
 * recalculation this tab has saved goes to Targets. Only a step not yet drawn is judged, so the save that marks
 * the account set up cannot take the page from the step that made it.
 */
function finishedAddressOf(mode: SetupMode, isSetUp: boolean | undefined): string | undefined {
  if (mode === "first-run") {
    return isSetUp === true ? diaryHref({}) : undefined;
  }
  return wasRecalculationSaved() ? setupExitPath() : undefined;
}
