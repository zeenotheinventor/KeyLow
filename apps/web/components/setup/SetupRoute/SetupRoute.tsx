"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useSetupFlow } from "../SetupFlow";
import { SetupScreen } from "../SetupScreen";

import type { SetupRouteProps } from "./types";

import { readSetupStep, setupPath, stepToRedirectTo } from "@/lib/setupRoutes";

/**
 * A step's address. The address is the source of truth: the reducer is told of the step with `stepOpened` when
 * the address is on show, on arrival and on the browser's Back. The reducer accepts any step, so this is where
 * an address is stopped: one whose earlier steps are unanswered, such as the estimate on an empty draft, is
 * replaced by the first incomplete step, and so is anything that is not a step. It waits until the saved
 * answers have joined or the read has ended, so a recalculation is not sent back before its answers arrive.
 * Nothing is drawn while the person is being sent on, and a screen that has been drawn stays, so a late
 * answer cannot take the page from under what is being typed.
 */
export function SetupRoute({ segment, mode }: SetupRouteProps) {
  const router = useRouter();
  const { state, dispatch, today, isAddressJudgeable } = useSetupFlow();
  const step = segment === undefined ? "sex" : readSetupStep(segment);
  const redirectTo =
    step === undefined
      ? "sex"
      : isAddressJudgeable
        ? stepToRedirectTo(state.draft, step, today)
        : undefined;
  const [isShown, setIsShown] = useState(false);
  if (!isShown && isAddressJudgeable && step !== undefined && redirectTo === undefined) {
    setIsShown(true);
  }
  const stepOnShow = isShown && redirectTo === undefined ? step : undefined;

  useEffect(() => {
    if (redirectTo !== undefined) {
      router.replace(setupPath(redirectTo, mode));
    }
  }, [redirectTo, mode, router]);

  useEffect(() => {
    if (stepOnShow !== undefined) {
      dispatch({ type: "stepOpened", step: stepOnShow });
    }
  }, [stepOnShow, dispatch]);

  return stepOnShow === undefined ? null : <SetupScreen step={stepOnShow} mode={mode} />;
}
