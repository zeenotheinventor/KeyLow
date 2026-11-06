"use client";

import {
  describeSetupCaption,
  describeStepProgress,
  RETRY_LABEL,
  SETUP_SHELL,
  setupQuestionFor,
} from "@keylow/core/copy";
import { isStepComplete, nextStep, previousStep, progressFraction } from "@keylow/core/setup";
import { useRouter } from "next/navigation";

import { useSetupFlow } from "../SetupFlow";
import { SetupShell } from "../SetupShell";
import { BirthDateStep } from "../steps/BirthDateStep";
import { BodyStep } from "../steps/BodyStep";
import { SexStep } from "../steps/SexStep";

import type { SetupScreenProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { setupExitPath, setupPath } from "@/lib/setupRoutes";

/**
 * One step of the setup wizard, in its shell. The answers are kept by the flow's layout, so Back loses none.
 * Continue sends `continued` and opens the next step's address, and Back opens the previous one's, so the
 * browser's Back agrees. Close leaves for Targets at once with no dialog, as the phone does, since nothing is
 * saved until the estimate. When the saved answers could not be read the step stays usable, with a banner and
 * Try again. The steps after the body, and the estimate, are the tickets that follow this one.
 */
export function SetupScreen({ step, mode }: SetupScreenProps) {
  const router = useRouter();
  const { state, dispatch, today, weightUnit, readFailure } = useSetupFlow();
  const { draft } = state;
  const question = setupQuestionFor(step, draft);
  const progress = describeStepProgress(draft, step);
  const previous = previousStep(draft, step);
  const next = nextStep(draft, step);

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
      case "goal":
      case "rate":
      case "protein":
      case "diet":
      case "estimate":
        // The later questions and the estimate are added by the tickets that follow.
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
        // The estimate is the next ticket's, so the last question stops here until it is built.
        isEnabled: isStepComplete(draft, step, today) && next !== undefined && next !== "estimate",
        onPress: () => {
          if (next === undefined) {
            return;
          }
          dispatch({ type: "continued", today });
          router.push(setupPath(next, mode));
        },
      }}
      notice={
        readFailure === undefined ? undefined : (
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
