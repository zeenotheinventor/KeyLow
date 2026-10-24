import {
  ACCURACY_LINE_BEFORE_CHECKIN,
  OFFLINE_BANNER,
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

import type { EstimateStepProps } from "./types";

/**
 * The last step of the wizard: the starting targets and the energy they come from, labelled as an
 * estimate, with the footer that saves them. It owns the shell because its footer is a button with banners
 * above it, which the other steps' Continue is not. It draws what `startingPlan` made and works out
 * nothing: the expenditure is shown in whole kilocalories.
 */
export function EstimateStep({
  answers,
  plan,
  mode,
  onStart,
  isSaving,
  saveFailed,
  isOffline,
  onBack,
  onClose,
}: EstimateStepProps) {
  return (
    <SetupShell
      footer={
        <>
          {isOffline ? (
            <Banner body={OFFLINE_BANNER.body} title={OFFLINE_BANNER.title} variant="offline" />
          ) : null}
          {saveFailed ? <Banner sentence title={SAVE_FAILED_BANNER} variant="error" /> : null}
          <Button
            disabled={isOffline}
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
      question={SETUP_ESTIMATE.heading}
      subtitle={undefined}
      title={SETUP_GROUP_TITLES.estimate}
      onBack={onBack}
      onClose={mode === "recalculate" ? onClose : undefined}
    >
      <EstimateCard lines={describeEstimateLines(answers, plan)} targets={plan.targets} />
      <GroupedList hidesTitle title={SETUP_ESTIMATE.expenditure.title}>
        <ListRow
          chevron={false}
          subtitle={SETUP_ESTIMATE.expenditure.caption}
          title={SETUP_ESTIMATE.expenditure.title}
          unit={SETUP_ESTIMATE.expenditure.unit}
          value={formatCalories(plan.estimate.expenditureKcal)}
        />
      </GroupedList>
      <View className="gap-2">
        <Text tone="secondary" variant="caption">
          {ACCURACY_LINE_BEFORE_CHECKIN}
        </Text>
        <Text tone="muted" variant="caption">
          {SETUP_ESTIMATE.notMedicalAdvice}
        </Text>
      </View>
    </SetupShell>
  );
}
