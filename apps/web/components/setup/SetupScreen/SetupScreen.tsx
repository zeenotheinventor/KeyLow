"use client";

import { useSkipSetup } from "@keylow/api-client";
import {
  describeSetupCaption,
  describeStepProgress,
  RETRY_LABEL,
  SAVE_FAILED_BANNER,
  SETUP_SHELL,
  setupQuestionFor,
} from "@keylow/core/copy";
import {
  allowedGoalsOf,
  isRateGoal,
  isStepComplete,
  nextStep,
  previousStep,
  progressFraction,
} from "@keylow/core/setup";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useSetupFlow } from "../SetupFlow";
import { SetupShell } from "../SetupShell";
import { ActivityStep } from "../steps/ActivityStep";
import { BirthDateStep } from "../steps/BirthDateStep";
import { BodyStep } from "../steps/BodyStep";
import { DietStep } from "../steps/DietStep";
import { EstimateStep } from "../steps/EstimateStep";
import { GoalStep } from "../steps/GoalStep";
import { ProteinStep } from "../steps/ProteinStep";
import { RateStep } from "../steps/RateStep";
import { SexStep } from "../steps/SexStep";
import { useProgrammeReads } from "../useProgrammeReads";

import type { SetupScreenProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { setupExitPath, setupPath } from "@/lib/setupRoutes";

// The phone's /targets is not a web route: the manual Targets page is under More.
const OWN_TARGETS_PATH = setupExitPath();

/**
 * One step of the setup wizard, in its shell. The answers are kept by the flow's layout, so Back loses none.
 * Continue sends `continued` and opens the next step's address, and Back opens the previous one's, so the
 * browser's Back agrees. Close leaves for Targets at once with no dialog, as the phone does, since nothing is
 * saved until the estimate. When the saved answers could not be read the step stays usable, with a banner and
 * Try again. The estimate brings its own shell, because its footer is a save and not a Continue.
 */
export function SetupScreen({ step, mode }: SetupScreenProps) {
  const router = useRouter();
  const { state, dispatch, today, weightUnit, readFailure } = useSetupFlow();
  const { draft } = state;
  const question = setupQuestionFor(step, draft);
  const programme = useProgrammeReads(mode);
  const progress = describeStepProgress(draft, step);
  const previous = previousStep(draft, step);
  const next = nextStep(draft, step);
  const skipSetup = useSkipSetup();
  const escapeButton = useRef<HTMLButtonElement>(null);
  const isSkipStarted = useRef(false);
  const isMounted = useRef(false);
  // The first run's one way out of step 1. A recalculation has Close, and later steps have Back.
  const isEscapeShown = mode === "first-run" && previous === undefined;
  // Busy from the press until the page has gone, since a skip that is done stays done.
  const isSkipping = skipSetup.isPending || skipSetup.isSuccess;

  // Not set in the render, so a page the strict mode mounts twice ends up marked mounted.
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // The failed write leaves focus on the button that was pressed, which was off while it ran, so it goes back there.
  useEffect(() => {
    if (skipSetup.isError) {
      escapeButton.current?.focus();
    }
  }, [skipSetup.isError]);

  async function skip() {
    if (isSkipStarted.current) {
      return;
    }
    isSkipStarted.current = true;
    try {
      await skipSetup.mutateAsync();
    } catch {
      // The error's own words are never shown. The next press retries.
      isSkipStarted.current = false;
      return;
    }
    // The way on is only for a page that is still here. Nothing the programme or the targets read has changed,
    // so there is nothing to drop from the cache.
    if (isMounted.current) {
      router.replace(OWN_TARGETS_PATH);
    }
  }

  if (step === "estimate") {
    return <EstimateStep mode={mode} programme={programme} />;
  }
  if (question === undefined) {
    return null;
  }

  function renderAnswers() {
    switch (step) {
      case "sex":
        return (
          <SexStep
            value={draft.sex}
            onChange={(sex) => {
              dispatch({ type: "sexChosen", sex });
            }}
          />
        );
      case "birthDate":
        return (
          <BirthDateStep
            today={today}
            value={draft.birthDate}
            onChange={(birthDate) => {
              dispatch({ type: "birthDateChanged", birthDate, today });
            }}
          />
        );
      case "body":
        return (
          <BodyStep
            heightCm={draft.heightCm}
            today={today}
            weighInDate={state.weightFromWeighInOn}
            weightKg={draft.weightKg}
            weightUnit={weightUnit}
            onChange={(body) => {
              dispatch({ type: "bodyChanged", ...body });
            }}
          />
        );
      case "activity":
        return (
          <ActivityStep
            value={draft.activity}
            onChange={(activity) => {
              dispatch({ type: "activityChosen", activity });
            }}
          />
        );
      case "goal":
        return (
          <GoalStep
            allowedGoals={allowedGoalsOf(draft, today)}
            value={draft.goal}
            onChange={(goal) => {
              dispatch({ type: "goalChosen", goal });
            }}
          />
        );
      case "rate":
        // The address check has made sure of a goal that moves the weight and the weight from step 3, so
        // this only narrows the types.
        return !isRateGoal(draft.goal) || draft.weightKg === undefined ? null : (
          <RateStep
            goal={draft.goal}
            value={draft.ratePctPerWeek}
            weightKg={draft.weightKg}
            weightUnit={weightUnit}
            onChange={(ratePctPerWeek) => {
              dispatch({ type: "rateChosen", ratePctPerWeek });
            }}
          />
        );
      case "protein":
        return draft.weightKg === undefined ? null : (
          <ProteinStep
            value={draft.proteinPreset}
            weightKg={draft.weightKg}
            onChange={(proteinPreset) => {
              dispatch({ type: "proteinChosen", proteinPreset });
            }}
          />
        );
      case "diet":
        return (
          <DietStep
            value={draft.dietStyle}
            onChange={(dietStyle) => {
              dispatch({ type: "dietChosen", dietStyle });
            }}
          />
        );
      case "estimate":
        // The estimate brings its own shell, so the shell above is never drawn for it.
        return null;
    }
  }

  return (
    <SetupShell
      stepKey={step}
      caption={describeSetupCaption(draft, step)}
      progressName={progress.progressName}
      progressFraction={progressFraction(draft, step)}
      question={question.question}
      helper={question.helper}
      onBack={
        previous === undefined
          ? undefined
          : () => {
              router.push(setupPath(previous, mode));
            }
      }
      onClose={
        mode === "recalculate"
          ? () => {
              router.replace(setupExitPath());
            }
          : undefined
      }
      continueAction={{
        isEnabled: isStepComplete(draft, step, today) && next !== undefined && !isSkipping,
        onPress: () => {
          if (next === undefined) {
            return;
          }
          dispatch({ type: "continued", today });
          router.push(setupPath(next, mode));
        },
      }}
      escapeButtonRef={escapeButton}
      escapeAction={
        isEscapeShown
          ? {
              label: SETUP_SHELL.setOwnTargetsLabel,
              onPress: () => {
                void skip();
              },
              isLoading: isSkipping,
            }
          : undefined
      }
      notice={
        isEscapeShown && skipSetup.isError ? (
          <Banner tone="error">{SAVE_FAILED_BANNER}</Banner>
        ) : readFailure === undefined ? undefined : (
          <Banner
            tone="error"
            action={{
              label: RETRY_LABEL,
              onClick: readFailure.retry,
              disabled: readFailure.isRetrying,
            }}
          >
            {SETUP_SHELL.readFailed}
          </Banner>
        )
      }
    >
      {renderAnswers()}
    </SetupShell>
  );
}
