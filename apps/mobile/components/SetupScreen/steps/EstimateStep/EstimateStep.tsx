import {
  ACCURACY_LINE_WITH_CHECKIN,
  describeMeasuredAccuracyLine,
  OFFLINE_BANNER,
  PROGRAM_SETUP_CARRIED_FORWARD,
  PROGRAM_SETUP_MEASURED,
  SAVE_FAILED_BANNER,
  SETUP_ESTIMATE,
  SETUP_GROUP_TITLES,
  SETUP_SHELL,
} from "@keylow/core/copy";
import { formatCalories } from "@keylow/core/format";
import { View } from "react-native";

import { describeEstimateLines } from "./describeEstimateLines";
import { EstimateCard } from "./EstimateCard";
import { Banner, Button, GroupedList, ListRow, Text } from "../../../ui";
import { SetupShell } from "../../SetupShell";

import type { EstimateMeasurement, EstimateStepProps } from "./types";

type EstimateWords = Readonly<{
  heading: string;
  expenditureSubtitle: string;
  accuracyLine: string;
}>;

// After a check-in the screen says where the expenditure came from, and that changing the answers keeps it.
function wordsOf(measurement: EstimateMeasurement | undefined): EstimateWords {
  switch (measurement?.kind) {
    case "measured":
      return {
        heading: PROGRAM_SETUP_MEASURED.heading,
        expenditureSubtitle: PROGRAM_SETUP_MEASURED.expenditureSubtitle,
        accuracyLine: describeMeasuredAccuracyLine(measurement.measuredOn),
      };
    case "carried-forward":
      return {
        heading: PROGRAM_SETUP_MEASURED.heading,
        expenditureSubtitle: PROGRAM_SETUP_CARRIED_FORWARD.expenditureSubtitle,
        accuracyLine: PROGRAM_SETUP_CARRIED_FORWARD.accuracyLine,
      };
    case undefined:
      return {
        heading: SETUP_ESTIMATE.heading,
        expenditureSubtitle: SETUP_ESTIMATE.expenditure.caption,
        accuracyLine: ACCURACY_LINE_WITH_CHECKIN,
      };
  }
}

/**
 * The last step of the wizard: the starting targets and the energy they come from, labelled as an
 * estimate, with the footer that saves them. It owns the shell because its footer is a button with banners
 * above it, which the other steps' Continue is not. It draws the plan it is given and works out nothing:
 * the expenditure is shown in whole kilocalories. A `measurement` says the plan comes from a check-in's
 * expenditure, and the words change with it.
 */
export function EstimateStep({
  answers,
  plan,
  measurement,
  mode,
  onStart,
  isSaving,
  saveFailed,
  isOffline,
  isWaitingForProgramme = false,
  onBack,
  onClose,
}: EstimateStepProps) {
  const words = wordsOf(measurement);

  return (
    <SetupShell
      footer={
        <>
          {isOffline ? (
            <Banner body={OFFLINE_BANNER.body} title={OFFLINE_BANNER.title} variant="offline" />
          ) : null}
          {saveFailed ? <Banner sentence title={SAVE_FAILED_BANNER} variant="error" /> : null}
          <Button
            disabled={isOffline || isWaitingForProgramme}
            fullWidth
            haptic="confirm"
            loading={isSaving}
            size="lg"
            onPress={onStart}
          >
            {mode === "recalculate" ? SETUP_SHELL.saveTargetsLabel : SETUP_SHELL.startLabel}
          </Button>
        </>
      }
      isHeaderInert={isSaving}
      progressName={SETUP_SHELL.setupCompleteName}
      progressPercent={100}
      question={words.heading}
      subtitle={undefined}
      title={SETUP_GROUP_TITLES.estimate}
      onBack={onBack}
      onClose={mode === "recalculate" ? onClose : undefined}
    >
      <EstimateCard lines={describeEstimateLines(answers, plan)} targets={plan.targets} />
      <GroupedList hidesTitle title={SETUP_ESTIMATE.expenditure.title}>
        <ListRow
          chevron={false}
          subtitle={words.expenditureSubtitle}
          title={SETUP_ESTIMATE.expenditure.title}
          unit={SETUP_ESTIMATE.expenditure.unit}
          value={formatCalories(plan.estimate.expenditureKcal)}
        />
      </GroupedList>
      <View className="gap-2">
        <Text tone="secondary" variant="caption">
          {words.accuracyLine}
        </Text>
        <Text tone="muted" variant="caption">
          {SETUP_ESTIMATE.notMedicalAdvice}
        </Text>
      </View>
    </SetupShell>
  );
}
