"use client";

import { useProfileTimeZone, useSaveSetup } from "@keylow/api-client";
import {
  describeEstimateLines,
  describeEstimateWords,
  describeSetupCaption,
  describeStepProgress,
  OFFLINE_BANNER,
  RETRY_LABEL,
  SAVE_FAILED_BANNER,
  SETUP_ESTIMATE,
  SETUP_SHELL,
  TARGETS_PAGE,
  TARGETS_SAVED_TOAST,
} from "@keylow/core/copy";
import { toLocalDate } from "@keylow/core/dates";
import { formatCalories } from "@keylow/core/format";
import { progressFraction, previousStep } from "@keylow/core/setup";
import { useQueryClient } from "@tanstack/react-query";
import { Check, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EstimateCard } from "./EstimateCard";
import { useEstimate } from "./useEstimate";
import { useSetupFlow } from "../../SetupFlow";
import { SetupShell } from "../../SetupShell";
import { timeZoneOrDevice } from "../../timeZoneOrDevice";

import type { EstimateStepProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { GroupedList } from "@/components/ui/GroupedList";
import { ListRow } from "@/components/ui/ListRow";
import { useToast } from "@/components/ui/Toast";
import { diaryHref } from "@/lib/diary";
import { dropStaleTargetReads } from "@/lib/dropStaleTargetReads";
import { setupExitPath, setupPath } from "@/lib/setupRoutes";
import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";

/**
 * The last step of the wizard: the starting targets and the energy they come from, labelled as an estimate, with
 * the footer that saves them. It draws the plan core makes of the answers and works out nothing itself. After a
 * check-in a recalculation keeps the measured expenditure. The first run lands on the Diary, and a recalculation
 * returns to Targets with the toast Targets saved.
 *
 * Saving is held, with no way round it at the write, while the saved setup is not known (pending, failed or
 * paused offline): without it the stored weight unit and the latest weigh-in are unknown, and a save would
 * replace a stored unit and add a duplicate weigh-in. One save per press, with the guard a ref. The page is busy
 * from the press until it has gone, with Back and Close dimmed and inert, and keeps the figures it drew when
 * the press was made. A failed save shows the failed banner and Start stays live for the retry. Offline the page
 * says why Start is off. Nothing of the answers is logged.
 */
export function EstimateStep({ mode, programme }: EstimateStepProps) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const { state, setupState, readFailure } = useSetupFlow();
  const { draft } = state;
  const profileTimeZone = useProfileTimeZone();
  const now = useNow();
  const today = toLocalDate(now, timeZoneOrDevice(profileTimeZone.data));
  const estimate = useEstimate({ draft, today, setupState, programme });
  const saveSetup = useSaveSetup();
  const startButton = useRef<HTMLButtonElement>(null);
  const isSaveStarted = useRef(false);
  const isMounted = useRef(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [hasSaveFailed, setHasSaveFailed] = useState(false);
  const [heldView, setHeldView] = useState<ReturnType<typeof viewOf>>();

  // Busy from the press until the page has gone, so the moment between the save settling and the navigation
  // cannot be used to leave twice or to save again.
  const isBusy = saveSetup.isPending || hasSaved;
  const isRecalculating = mode === "recalculate";
  const isStartOff = !isOnline || setupState === undefined || programme.isWaiting;
  const previous = previousStep(draft, "estimate");

  // The notice slot holds one sentence: going offline replaces an earlier failed save, which must not come
  // back as a second banner when the connection returns.
  if (!isOnline && hasSaveFailed) {
    setHasSaveFailed(false);
  }

  // Not set in the render, so a page the strict mode mounts twice ends up marked mounted.
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // The failed save leaves focus on the button that was pressed, which was off while it ran, so it goes back there.
  useEffect(() => {
    if (hasSaveFailed && !saveSetup.isPending) {
      startButton.current?.focus();
    }
  }, [hasSaveFailed, saveSetup.isPending]);

  if (estimate === undefined) {
    return null;
  }

  const liveView = viewOf(estimate);
  const view = heldView ?? liveView;
  const progress = describeStepProgress(draft, "estimate");

  async function start() {
    if (
      estimate === undefined ||
      setupState === undefined ||
      !isOnline ||
      programme.isWaiting ||
      isSaveStarted.current
    ) {
      return;
    }
    isSaveStarted.current = true;
    setHasSaveFailed(false);
    setHeldView(liveView);
    try {
      await saveSetup.mutateAsync({
        save: estimate.save,
        latestWeighInKg: setupState.latestWeighIn?.weightKg ?? null,
        timeZone: timeZoneOrDevice(profileTimeZone.data),
      });
    } catch {
      // The error's own words are never shown: they can quote a value.
      isSaveStarted.current = false;
      setHeldView(undefined);
      if (isMounted.current) {
        setHasSaveFailed(true);
      }
      return;
    }
    dropStaleTargetReads(queryClient);
    if (isRecalculating) {
      // The provider sits above every page, so the toast tells a person who left by Back that it saved.
      toast.show({ message: TARGETS_SAVED_TOAST, tone: "success", icon: Check });
    }
    // The way on is only for a page that is still here.
    if (!isMounted.current) {
      return;
    }
    setHasSaved(true);
    router.replace(isRecalculating ? setupExitPath() : diaryHref({}));
  }

  function noticeOf() {
    if (!isOnline) {
      return (
        <Banner title={OFFLINE_BANNER.title} icon={WifiOff}>
          {SETUP_ESTIMATE.offlineBody}
        </Banner>
      );
    }
    if (readFailure !== undefined) {
      return (
        <Banner
          tone="error"
          action={{
            label: RETRY_LABEL,
            onClick: readFailure.retry,
            disabled: readFailure.isRetrying,
          }}
        >
          {SETUP_ESTIMATE.readFailedBody}
        </Banner>
      );
    }
    return hasSaveFailed ? <Banner tone="error">{SAVE_FAILED_BANNER}</Banner> : undefined;
  }

  return (
    <SetupShell
      stepKey="estimate"
      caption={describeSetupCaption(draft, "estimate")}
      progressName={progress.progressName}
      progressFraction={progressFraction(draft, "estimate")}
      question={view.words.heading}
      onBack={
        previous === undefined
          ? undefined
          : () => {
              router.push(setupPath(previous, mode));
            }
      }
      onClose={
        isRecalculating
          ? () => {
              router.replace(setupExitPath());
            }
          : undefined
      }
      isLeavingInert={isBusy}
      continueAction={{
        isEnabled: !isStartOff,
        isLoading: isBusy,
        loadingLabel: TARGETS_PAGE.saving,
        label: isRecalculating ? SETUP_SHELL.saveTargetsLabel : SETUP_SHELL.startLabel,
        onPress: () => {
          void start();
        },
      }}
      continueButtonRef={startButton}
      notice={noticeOf()}
    >
      <EstimateCard targets={view.targets} lines={view.lines} />
      <GroupedList hidesTitle title={SETUP_ESTIMATE.expenditure.title}>
        <ListRow
          title={SETUP_ESTIMATE.expenditure.title}
          subtitle={view.words.expenditureSubtitle}
          value={formatCalories(view.expenditureKcal)}
          unit={SETUP_ESTIMATE.expenditure.unit}
          valueLook="numeral"
        />
      </GroupedList>
      <div className="flex flex-col gap-2">
        <p className="text-caption text-text-secondary">{view.words.accuracyLine}</p>
        <p className="text-caption text-text-muted">{SETUP_ESTIMATE.notMedicalAdvice}</p>
      </div>
    </SetupShell>
  );
}

// Everything the page draws that comes from the plan, as one value, so a press can hold it.
function viewOf(estimate: NonNullable<ReturnType<typeof useEstimate>>) {
  return {
    words: describeEstimateWords(estimate.measurement),
    lines: describeEstimateLines(estimate.answers, estimate.plan),
    targets: estimate.plan.targets,
    expenditureKcal: estimate.plan.estimate.expenditureKcal,
  };
}
