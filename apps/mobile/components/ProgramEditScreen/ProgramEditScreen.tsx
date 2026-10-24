import {
  useExpenditureHistory,
  useProfileTimeZone,
  useProgramSummary,
  useSetupState,
  useWeightTrend,
  useWeightUnit,
} from "@keylow/api-client";
import { PROGRAM_ERROR, PROGRAM_SCREEN } from "@keylow/core/copy";
import { ageInYears, toLocalDate } from "@keylow/core/dates";
import { Redirect } from "expo-router";
import { View } from "react-native";

import { ProgramEditForm } from "./ProgramEditForm";
import { ProgramEditFrame } from "./ProgramEditFrame";
import { useCloseProgramEdit } from "./useCloseProgramEdit";
import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { ErrorState, Skeleton } from "../ui";

// How far back the expenditure history is read, a year of weekly check-ins, as the setup recalculation reads it.
// Its newest snapshot is the one a recompute keeps, whichever programme made it.
const EXPENDITURE_HISTORY_WEEKS = 52;

/**
 * The Edit programme screen, pushed over the Programme screen. It reads the active programme, the birth date,
 * the weight unit and the weight trend, and shows the form once they are there. The values of the rate and
 * protein cards are worked out at the trend weight, then at the latest weigh-in, then at the weight the current
 * targets were worked out at. The footnote names the newest expenditure estimate and waits for it without holding
 * the form back. Nothing of the programme is logged.
 */
export function ProgramEditScreen() {
  const close = useCloseProgramEdit();
  const isReadEnabled = useReadsEnabled();
  const now = useNow();
  const summary = useProgramSummary({ enabled: isReadEnabled });
  const setupState = useSetupState({ enabled: isReadEnabled });
  const weightUnit = useWeightUnit({ enabled: isReadEnabled });
  const timeZone = useProfileTimeZone({ enabled: isReadEnabled });
  const weightTrend = useWeightTrend({ enabled: isReadEnabled });
  const expenditureHistory = useExpenditureHistory({
    weeks: EXPENDITURE_HISTORY_WEEKS,
    enabled: isReadEnabled,
  });

  function retry() {
    void summary.refetch();
    void setupState.refetch();
    void weightUnit.refetch();
  }

  const isFailed = summary.isError || setupState.isError || weightUnit.isError;
  const isLoading =
    summary.data === undefined ||
    setupState.data === undefined ||
    weightUnit.data === undefined ||
    timeZone.isPending ||
    weightTrend.isLoading;

  if (!isFailed && summary.data?.program === null) {
    return <Redirect href="/more/program" />;
  }

  const program = summary.data?.program;
  const weightKg =
    weightTrend.points.at(-1)?.trendKg ??
    setupState.data?.latestWeighIn?.weightKg ??
    summary.data?.currentTargets?.basis.trendWeightKg;

  if (
    !isFailed &&
    !isLoading &&
    program !== undefined &&
    program !== null &&
    weightKg !== undefined
  ) {
    // If the zone cannot be read the day is UTC, as the other screens read it.
    const today = toLocalDate(now, timeZone.data ?? "UTC");
    const birthDate = setupState.data.stats.birthDate ?? null;
    const newestSnapshot = [...(expenditureHistory.data ?? [])]
      .sort((first, second) => first.asOfDate.localeCompare(second.asOfDate))
      .at(-1);

    return (
      <ProgramEditForm
        // No birth date is no proof of age, so the age is 0 and Lose is not offered, as the save decides it.
        ageYears={birthDate === null ? 0 : ageInYears(birthDate, today)}
        expenditureKcal={newestSnapshot?.muKcal ?? null}
        program={program}
        today={today}
        weightKg={weightKg}
        weightUnit={weightUnit.data}
      />
    );
  }

  return (
    <ProgramEditFrame onClose={close}>
      {isFailed || !isLoading ? (
        <View className="flex-1 pb-16">
          <ErrorState
            body={PROGRAM_ERROR.body}
            retry={{ label: PROGRAM_ERROR.retryLabel, onPress: retry }}
            title={PROGRAM_ERROR.title}
          />
        </View>
      ) : (
        <View
          accessible
          aria-label={PROGRAM_SCREEN.loadingName}
          aria-live="polite"
          className="flex-1 px-4 pt-1"
          role="status"
        >
          <Skeleton variant="program" />
        </View>
      )}
    </ProgramEditFrame>
  );
}
