import { useSetupState } from "@keylow/api-client";
import { SETUP_GROUP_TITLES, SETUP_QUESTIONS } from "@keylow/core/copy";
import { entryWeightUnit, previousStep } from "@keylow/core/setup";
import { getLocales } from "expo-localization";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { BackHandler } from "react-native";

import { describeStepProgress, isStepComplete } from "./setupDraftReducer";
import { SetupShell } from "./SetupShell";
import { BirthDateStep } from "./steps/BirthDateStep";
import { BodyStep } from "./steps/BodyStep";
import { SexStep } from "./steps/SexStep";
import { useSetupDraft } from "./useSetupDraft";
import { useToday } from "./useToday";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

import type { SetupScreenProps } from "./types";
import type { SetupStep } from "@keylow/core/setup";

function questionWordsOf(step: SetupStep) {
  switch (step) {
    case "sex":
      return SETUP_QUESTIONS.sex;
    case "birthDate":
      return SETUP_QUESTIONS.birthDate;
    case "body":
      return SETUP_QUESTIONS.body;
    default:
      return undefined;
  }
}

/**
 * The setup wizard. Steps and their order come from core, the answers are kept in a reducer so Back
 * loses none, and the saved answers are read once the Terms are accepted. The steps after the height and
 * weight are not built yet and draw only the header and the progress bar.
 */
export function SetupScreen({ mode }: SetupScreenProps) {
  const router = useRouter();
  const today = useToday();
  const setupState = useSetupState({ enabled: useReadsEnabled() });
  const regionCode = getLocales().at(0)?.regionCode;
  const { state, dispatch } = useSetupDraft(setupState.data, today, regionCode);
  const { draft, step } = state;
  const hasPreviousStep = previousStep(draft, step) !== undefined;
  const isRecalculating = mode === "recalculate";

  function goBack() {
    dispatch({ type: "wentBack" });
  }

  const close = useCallback(() => {
    // A cold link to this screen has nothing before it, so Close goes to Targets itself.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/targets");
    }
  }, [router]);

  // Only while Setup is the focused screen, so a route pushed over it keeps its own back button. The first
  // run's step 1 is left to the system, which is the first run gate's to decide.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (hasPreviousStep) {
          dispatch({ type: "wentBack" });
          return true;
        }
        if (isRecalculating) {
          close();
          return true;
        }
        return false;
      });

      return () => {
        subscription.remove();
      };
    }, [close, dispatch, hasPreviousStep, isRecalculating]),
  );

  const progress = describeStepProgress(draft, step);
  const words = questionWordsOf(step);

  function renderStep() {
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
            // Until the saved answers arrive the draft has no unit, and the fields start from the stored one or the region's.
            weightUnit={
              draft.weightUnit ??
              entryWeightUnit(setupState.data?.stats.weightUnit ?? null, regionCode)
            }
            onChange={(body) => {
              dispatch({ type: "bodyChanged", ...body });
            }}
          />
        );
      default:
        return null;
    }
  }

  return (
    <SetupShell
      continueAction={
        words === undefined
          ? undefined
          : {
              isEnabled: isStepComplete(draft, step, today),
              onPress: () => {
                dispatch({ type: "continued", today });
              },
            }
      }
      helper={words?.helper}
      progressName={progress.progressName}
      progressPercent={progress.percent}
      question={words?.question}
      subtitle={progress.subtitle}
      title={SETUP_GROUP_TITLES[step]}
      onBack={hasPreviousStep ? goBack : undefined}
      onClose={isRecalculating ? close : undefined}
    >
      {renderStep()}
    </SetupShell>
  );
}
