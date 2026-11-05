import { useProfileTimeZone } from "@keylow/api-client";
import { describeGoalAnswerRows, describeGoalSetOn, GOAL_SCREEN } from "@keylow/core/copy";
import { toLocalDate } from "@keylow/core/dates";
import { goalAnswersOfRow } from "@keylow/core/training";
import { useFocusEffect, useRouter } from "expo-router";
import { vars } from "nativewind";
import { useCallback } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { goalQuestionPath, goalSummaryPath } from "../../../lib/goalRoutes";
import { useOpenOnce } from "../../../lib/useOpenOnce";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";
import { Button, GroupedList, SheetHeader, Text } from "../../ui";
import { GoalAnswerRow } from "../GoalAnswerRow";
import { useCloseGoalFlow } from "../useCloseGoalFlow";
import { useGoalDraft } from "../useGoalDraft";

import type { GoalScreenProps } from "./types";

/**
 * "Goal", the screen the Goal row in More opens once a goal is stored: the six answers as rows that each open
 * their question, the note that changing one starts a new goal from today, See your priorities, and the day the
 * goal was set. A row reopens the questionnaire at its question with every answer filled, and finishing walks
 * on to the summary, where Save goal stores a new goal and the person comes back here. See your priorities
 * opens that summary for the answers as stored, with nothing to save. Every time this screen is in front the
 * draft starts over from the stored goal, so an answer changed and not saved is dropped, and a goal just saved
 * is what the next change is counted against. The day is dated in the user's time zone and is not drawn until
 * that is read, so it does not show and then change.
 */
export function GoalScreen({ goal }: GoalScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const closeFlow = useCloseGoalFlow();
  const openOnce = useOpenOnce();
  const { restart } = useGoalDraft();
  const timeZone = useProfileTimeZone({ enabled: useReadsEnabled() });

  useFocusEffect(
    useCallback(() => {
      restart(goalAnswersOfRow(goal));
    }, [restart, goal]),
  );

  const rows = describeGoalAnswerRows(goal);

  return (
    // The inset is a runtime value no class can name, so it goes through a variable, as the questions' do.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: GOAL_SCREEN.backLabel, onPress: closeFlow }}
        title={GOAL_SCREEN.title}
      />
      <ScrollView contentContainerClassName="gap-3 px-4 pb-8 pt-1">
        <GroupedList hidesTitle title={GOAL_SCREEN.title}>
          {rows.map((row, index) => (
            <GoalAnswerRow
              key={row.step}
              label={row.label}
              name={row.name}
              value={row.value}
              onPress={() => {
                openOnce(() => {
                  router.push(goalQuestionPath(index + 1));
                });
              }}
            />
          ))}
        </GroupedList>
        <Text className="px-1" tone="muted" variant="caption">
          {GOAL_SCREEN.changeNote}
        </Text>
        <Button
          fullWidth
          variant="secondary"
          onPress={() => {
            openOnce(() => {
              router.push(goalSummaryPath());
            });
          }}
        >
          {GOAL_SCREEN.prioritiesAction}
        </Button>
        {timeZone.isPending ? null : (
          <Text className="px-1" tone="muted" variant="caption">
            {describeGoalSetOn(toLocalDate(new Date(goal.effective_from), timeZone.data ?? "UTC"))}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
