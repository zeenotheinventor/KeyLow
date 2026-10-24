import {
  useExpenditureHistory,
  useProfileTimeZone,
  useSaveSetup,
  useSetupState,
  useSkipSetup,
  useWeightTrend,
} from "@keylow/api-client";
import {
  SAVE_FAILED_BANNER,
  SETUP_GROUP_TITLES,
  SETUP_QUESTIONS,
  SETUP_SHELL,
  TARGETS_SAVED_TOAST,
} from "@keylow/core/copy";
import {
  entryWeightUnit,
  isRateGoal,
  previousStep,
  setupAnswersSchemaFor,
  startingPlan,
} from "@keylow/core/setup";
import { getLocales } from "expo-localization";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler } from "react-native";

import { measuredEstimateOf } from "./measuredEstimate";
import { allowedGoalsOf, describeStepProgress, isStepComplete } from "./setupDraftReducer";
import { SetupShell } from "./SetupShell";
import { ActivityStep } from "./steps/ActivityStep";
import { BirthDateStep } from "./steps/BirthDateStep";
import { BodyStep } from "./steps/BodyStep";
import { DietStep } from "./steps/DietStep";
import { EstimateStep } from "./steps/EstimateStep";
import { GoalStep } from "./steps/GoalStep";
import { ProteinStep } from "./steps/ProteinStep";
import { RateStep } from "./steps/RateStep";
import { SexStep } from "./steps/SexStep";
import { storedWeightUnitOf } from "./storedWeightUnit";
import { useSetupDraft } from "./useSetupDraft";
import { timeZoneOrDevice, useToday } from "./useToday";
import { useIsOnline } from "../../lib/connectivity";
import { diaryHref } from "../../lib/navigation";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { Banner, useToast } from "../ui";

import type { SetupScreenProps } from "./types";
import type { SetupDraft, SetupStep } from "@keylow/core/setup";

// The rate is only asked for a goal that moves the weight, and its question names the direction.
function questionWordsOf(step: SetupStep, draft: SetupDraft) {
  switch (step) {
    case "sex":
      return SETUP_QUESTIONS.sex;
    case "birthDate":
      return SETUP_QUESTIONS.birthDate;
    case "body":
      return SETUP_QUESTIONS.body;
    case "activity":
      return SETUP_QUESTIONS.activity;
    case "goal":
      return SETUP_QUESTIONS.goal;
    case "rate":
      return isRateGoal(draft.goal) ? SETUP_QUESTIONS.rate[draft.goal] : undefined;
    case "protein":
      return SETUP_QUESTIONS.protein;
    case "diet":
      return SETUP_QUESTIONS.diet;
    case "estimate":
      return undefined;
  }
}

// How far back the expenditure history is read, a year of weekly check-ins. The newest snapshot decides whether
// the recompute keeps its mean (28 days at most), and the same list holds the newest check-in that measured,
// which can be much older.
const EXPENDITURE_HISTORY_WEEKS = 52;

/**
 * The setup wizard. Steps and their order come from core, the answers are kept in a reducer so Back
 * loses none, and the saved answers are read once the Terms are accepted. The last step is the estimate,
 * which draws the starting plan of the answers and saves it: the first run then lands on the Diary, and a
 * recalculation goes back to Targets with the Toast "Targets saved". The first run's step 1 has no way back
 * but the escape, "I'll set my own targets", which marks the account set up and opens Targets. Nothing of
 * the answers is logged.
 */
export function SetupScreen({ mode }: SetupScreenProps) {
  const router = useRouter();
  const toast = useToast();
  const saveSetup = useSaveSetup();
  const skipSetup = useSkipSetup();
  const isSaveStarted = useRef(false);
  const isSkipStarted = useRef(false);
  const isMounted = useRef(false);
  const [hasSaved, setHasSaved] = useState(false);
  const today = useToday();
  const isReadEnabled = useReadsEnabled();
  const setupState = useSetupState({ enabled: isReadEnabled });
  const regionCode = getLocales().at(0)?.regionCode;
  const { state, dispatch } = useSetupDraft(setupState.data, today, regionCode);
  const { draft, step } = state;
  // The profile's time zone is only read once the estimate is reached, which is when its date is needed.
  const profileTimeZone = useProfileTimeZone({ enabled: isReadEnabled && step === "estimate" });
  const estimateToday = useToday(profileTimeZone.data);
  const isOnline = useIsOnline();
  const hasPreviousStep = previousStep(draft, step) !== undefined;
  const isRecalculating = mode === "recalculate";
  // A recalculation after a check-in keeps the measured expenditure, so the estimate shows what the recompute
  // will write. What it needs is read from the moment the wizard opens, so it is there when the estimate is.
  // A new account has no programme, and its first run reads none of it.
  const areProgrammeReadsEnabled = isReadEnabled && isRecalculating;
  const expenditureHistory = useExpenditureHistory({
    weeks: EXPENDITURE_HISTORY_WEEKS,
    enabled: areProgrammeReadsEnabled,
  });
  const weightTrend = useWeightTrend({ enabled: areProgrammeReadsEnabled });
  const isWaitingForProgramme =
    isRecalculating && (expenditureHistory.isPending || weightTrend.isLoading);
  // The first run's one way out of step 1. A recalculation has Close, and later steps have Back.
  const isFirstRunEscapeShown = !isRecalculating && !hasPreviousStep;
  // Busy from the press until the screen has gone, so the moment between the save settling and the
  // navigation cannot be used to leave twice or to save again.
  const isSaving = saveSetup.isPending || hasSaved;
  // Likewise for the escape: busy until the screen has gone, since a skip that is done stays done.
  const isSkipping = skipSetup.isPending || skipSetup.isSuccess;

  function goBack() {
    dispatch({ type: "wentBack" });
  }

  // Not set in the render, so a screen the strict mode mounts twice ends up marked mounted.
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const close = useCallback(() => {
    // A cold link to this screen has nothing before it, so Close goes to Targets itself.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/targets");
    }
  }, [router]);

  // Only while Setup is the focused screen, so a route pushed over it keeps its own back button.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        // Like the on-screen Back and Close, which are dimmed: the press is taken and does nothing.
        if (isSaving) {
          return true;
        }
        if (hasPreviousStep) {
          dispatch({ type: "wentBack" });
          return true;
        }
        if (isRecalculating) {
          close();
        }
        // The first run's step 1 has no way back, since nothing is under it: the escape is the way out.
        return true;
      });

      return () => {
        subscription.remove();
      };
    }, [close, dispatch, hasPreviousStep, isRecalculating, isSaving]),
  );

  const storedWeightUnit = storedWeightUnitOf(setupState.data?.stats.weightUnit ?? null);
  // The estimate is only made on the last step, from answers that step's Continue has made complete, so the
  // check only narrows the type.
  const estimate = useMemo(() => {
    if (step !== "estimate") {
      return undefined;
    }
    const answers = setupAnswersSchemaFor(estimateToday).safeParse(draft);
    return answers.success
      ? {
          answers: answers.data,
          plan: startingPlan(answers.data, estimateToday, storedWeightUnit),
        }
      : undefined;
  }, [draft, estimateToday, step, storedWeightUnit]);

  // Undefined when the recompute starts again from the answers, until every read is known and when any of
  // them failed. The estimate of the answers is then drawn as it is, and the save's recompute still writes
  // the engine's targets.
  const measuredEstimate = useMemo(() => {
    const history = expenditureHistory.data;
    if (
      estimate === undefined ||
      history === undefined ||
      weightTrend.isLoading ||
      weightTrend.isError
    ) {
      return undefined;
    }
    return measuredEstimateOf({
      answers: estimate.answers,
      plan: estimate.plan,
      today: estimateToday,
      history,
      trendPoints: weightTrend.points,
      fallbackWeightKg: setupState.data?.latestWeighIn?.weightKg ?? estimate.answers.weightKg,
    });
  }, [
    estimate,
    estimateToday,
    expenditureHistory.data,
    setupState.data?.latestWeighIn?.weightKg,
    weightTrend.isError,
    weightTrend.isLoading,
    weightTrend.points,
  ]);

  // One save per press: the guard is a ref because a second press can arrive before the screen has drawn the
  // first, and the mutation's pending state is only read on the next draw. Whether a weigh-in is written is
  // the repo's to decide from the latest weigh-in's weight, so the screen only passes it. A failure is shown
  // by `saveSetup.isError` and the next press is the retry.
  async function start() {
    if (estimate === undefined || isSaveStarted.current) {
      return;
    }
    isSaveStarted.current = true;
    try {
      await saveSetup.mutateAsync({
        save: estimate.plan.save,
        latestWeighInKg: setupState.data?.latestWeighIn?.weightKg ?? null,
        timeZone: timeZoneOrDevice(profileTimeZone.data),
      });
    } catch {
      isSaveStarted.current = false;
      return;
    }
    // The save is done whether or not the screen is still here, and the navigation is only for a screen that is.
    if (!isMounted.current) {
      return;
    }
    setHasSaved(true);
    if (isRecalculating) {
      toast.show({ message: TARGETS_SAVED_TOAST, tone: "success", icon: "Check" });
      close();
    } else {
      router.replace(diaryHref(estimateToday));
    }
  }

  // One write per press, guarded by a ref for the same reason as the save. A failure is shown by
  // `skipSetup.isError`, and the next press is the retry. The write is done whether or not the screen is
  // still here, and the navigation is only for a screen that is.
  async function skip() {
    if (isSkipStarted.current) {
      return;
    }
    isSkipStarted.current = true;
    try {
      await skipSetup.mutateAsync();
    } catch {
      isSkipStarted.current = false;
      return;
    }
    if (isMounted.current) {
      router.replace("/targets");
    }
  }

  const progress = describeStepProgress(draft, step);
  const words = questionWordsOf(step, draft);
  // Until the saved answers arrive the draft has no unit, and the fields start from the stored one or the region's.
  const weightUnit =
    draft.weightUnit ?? entryWeightUnit(setupState.data?.stats.weightUnit ?? null, regionCode);

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
        // The rate is only reached with a goal that moves the weight and the weight from step 3, which
        // Continue on those steps makes sure of, so this only narrows the types.
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
        // The estimate brings its own shell, because its footer is not a Continue.
        return null;
    }
  }

  if (estimate !== undefined) {
    return (
      <EstimateStep
        answers={(measuredEstimate ?? estimate).answers}
        isOffline={!isOnline}
        isSaving={isSaving}
        isWaitingForProgramme={isWaitingForProgramme}
        measurement={measuredEstimate?.measurement}
        mode={mode}
        plan={(measuredEstimate ?? estimate).plan}
        saveFailed={saveSetup.isError}
        onBack={goBack}
        onClose={isRecalculating ? close : undefined}
        onStart={() => void start()}
      />
    );
  }

  return (
    <SetupShell
      continueAction={
        words === undefined
          ? undefined
          : {
              isEnabled: isStepComplete(draft, step, today) && !isSkipping,
              onPress: () => {
                dispatch({ type: "continued", today });
              },
            }
      }
      escapeAction={
        isFirstRunEscapeShown
          ? {
              label: SETUP_SHELL.setOwnTargetsLabel,
              isLoading: isSkipping,
              onPress: () => void skip(),
            }
          : undefined
      }
      notice={
        isFirstRunEscapeShown && skipSetup.isError ? (
          <Banner sentence title={SAVE_FAILED_BANNER} variant="error" />
        ) : undefined
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
