import { useActiveRoutine, useSaveTrainingGoals } from "@keylow/api-client";
import { describePriorities, GOAL_ERRORS, GOAL_SUMMARY } from "@keylow/core/copy";
import { deriveMusclePriority, GOAL_PRESETS_V1, summarisePriorities } from "@keylow/core/training";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { useMemo, useRef } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBodyFigure } from "../../../lib/bodyFigure";
import { BodyFigure, Button, Card, SheetHeader, Text, useToast } from "../../ui";
import { priorityFigureValues } from "../priorityFigureValues";
import { PriorityRow } from "../PriorityRow";
import { useCloseGoalFlow } from "../useCloseGoalFlow";

import type { GoalSummaryScreenProps } from "./types";

const FIGURE_WIDTH = 70;

// The space a figure takes at that width, 154 points tall from the 200 by 440 drawing, which is held while
// the figures are not drawn so the legend beside them does not move. The classes are written out so
// Tailwind sees them.
const FIGURE_SPACE_CLASS_NAME = "h-[154px] w-[70px] shrink-0";

// The footer sits on the bottom inset, and never closer than 12 points to the screen's edge.
const MINIMUM_FOOTER_BOTTOM_PADDING = 12;

/**
 * "Your priorities", the last screen of the goal questionnaire: the answers restated, a row for each group of
 * muscles, the front and back of the body filled on the volume scale, and Save goal. The rows count the
 * muscles of the active routine as kept up, as the plan does. While the routine is being read the rows and the
 * figures are not drawn, so no muscle shows as left out and then flips to kept up when the routine arrives. A
 * routine that cannot be read counts as none. The answers line, the legend and Save goal do not wait for it.
 * The figures are always the flat drawings, in the male or female figure the setting has. Save goal sends the
 * answers once, however often it is pressed, and then leaves the flow. A save that fails keeps the answers and
 * shows the error toast, so it can be tried again. Nothing the answers say reaches a log or a report from here.
 */
export function GoalSummaryScreen({ answers }: GoalSummaryScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const closeFlow = useCloseGoalFlow();
  const { figure, isReady: isFigureReady } = useBodyFigure();
  const routine = useActiveRoutine();
  const saveGoal = useSaveTrainingGoals();
  // Set by the first press, so a second press in the same moment does not save and leave twice.
  const isSaving = useRef(false);

  // A read that failed has no data either, and counts as no routine so the screen does not wait for ever.
  const isRoutineKnown = routine.data !== undefined || routine.isError;
  const routineRead = routine.data ?? null;
  const { copy, values } = useMemo(() => {
    const summary = summarisePriorities(
      answers,
      deriveMusclePriority(answers, GOAL_PRESETS_V1),
      routineRead,
    );
    return { copy: describePriorities(summary), values: priorityFigureValues(summary) };
  }, [answers, routineRead]);

  function goBack() {
    router.back();
  }

  async function handleSave() {
    if (isSaving.current) {
      return;
    }
    isSaving.current = true;
    try {
      await saveGoal.mutateAsync(answers);
    } catch {
      // The error is not read: it can carry the answers, and the toast states the rule instead.
      isSaving.current = false;
      toast.show({ message: GOAL_ERRORS.save, tone: "danger" });
      return;
    }
    closeFlow();
  }

  return (
    // The insets are runtime values no class can name, so they go through variables, as the questions' do.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: GOAL_SUMMARY.backLabel, onPress: goBack }}
        title={GOAL_SUMMARY.title}
      />
      <ScrollView contentContainerClassName="gap-3 px-4 pb-4 pt-1">
        <Text tone="secondary">{copy.answers}</Text>
        <Card aria-label={GOAL_SUMMARY.prioritiesSectionName} role="region">
          <View className="gap-3">
            {isRoutineKnown
              ? copy.rows.map((row) => <PriorityRow key={row.group} {...row} />)
              : null}
          </View>
        </Card>
        <View className="flex-row gap-2">
          {isFigureReady && isRoutineKnown
            ? (["front", "back"] as const).map((side) => (
                <BodyFigure
                  key={side}
                  body={figure}
                  label={
                    side === "front" ? GOAL_SUMMARY.bodyMapFrontName : GOAL_SUMMARY.bodyMapBackName
                  }
                  scale="volume"
                  side={side}
                  values={values}
                  w={FIGURE_WIDTH}
                />
              ))
            : [0, 1].map((place) => <View key={place} className={FIGURE_SPACE_CLASS_NAME} />)}
          <Text className="flex-1 self-center" tone="muted" variant="caption">
            {copy.legend}
          </Text>
        </View>
      </ScrollView>
      <View
        className="border-t border-border bg-surface px-4 pt-3 pb-[var(--footer-bottom-padding)]"
        style={vars({
          "--footer-bottom-padding": Math.max(insets.bottom, MINIMUM_FOOTER_BOTTOM_PADDING),
        })}
      >
        <Button
          fullWidth
          haptic="confirm"
          loading={saveGoal.isPending}
          size="lg"
          onPress={() => {
            void handleSave();
          }}
        >
          {GOAL_SUMMARY.saveAction}
        </Button>
      </View>
    </View>
  );
}
