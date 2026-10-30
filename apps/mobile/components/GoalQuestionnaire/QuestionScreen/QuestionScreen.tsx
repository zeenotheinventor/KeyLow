import {
  describeQuestionStep,
  describeQuestionStepName,
  GOAL_QUESTION_STEPS,
  GOAL_QUESTIONNAIRE,
} from "@keylow/core/copy";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, IconButton, ProgressBar, Text } from "../../ui";

import type { QuestionScreenProps } from "./types";

const QUESTION_COUNT = GOAL_QUESTION_STEPS.length;

// The footer sits on the bottom inset, and never closer than 12 points to the screen's edge.
const MINIMUM_FOOTER_BOTTOM_PADDING = 12;

/**
 * What each question of the goal questionnaire sits in, as the goals boards draw it: Close at the left of
 * the header with "Your goal · n of 6" centred beside it, the progress bar under them, the title and help
 * line, the answers scrolling, the note under them, and a footer with Back (from the second question) and
 * Next, which reads "See your priorities" on the sixth. The caller keeps the answers and decides what
 * Close, Back and Next do. Any of the six questions fits it.
 */
export function QuestionScreen({
  step,
  title,
  help,
  note,
  isNextEnabled,
  onClose,
  onBack,
  onNext,
  children,
}: QuestionScreenProps) {
  const insets = useSafeAreaInsets();
  const nextLabel =
    step === QUESTION_COUNT ? GOAL_QUESTIONNAIRE.finalAction : GOAL_QUESTIONNAIRE.nextAction;

  return (
    // The insets are runtime values no class can name, so they go through variables, as the setup shell's do.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <View className="gap-3 px-4 pb-3 pt-3">
        <View className="flex-row items-center gap-2">
          <IconButton icon="X" label={GOAL_QUESTIONNAIRE.closeLabel} onPress={onClose} />
          <Text
            accessibilityLabel={describeQuestionStepName(step)}
            className="flex-1 text-center tabular-nums"
            tone="secondary"
            variant="caption"
          >
            {describeQuestionStep(step)}
          </Text>
          {/* The width of Close, so the caption stays in the middle. */}
          <View className="w-touch-target" />
        </View>
        <ProgressBar
          label={GOAL_QUESTIONNAIRE.progressName}
          value={(step / QUESTION_COUNT) * 100}
        />
      </View>
      <ScrollView contentContainerClassName="gap-3 px-4 pb-4 pt-2">
        <Text role="heading" variant="h1">
          {title}
        </Text>
        <Text tone="secondary">{help}</Text>
        <View className="mt-2">{children}</View>
        {note === null ? null : (
          <Text tone="muted" variant="caption">
            {note}
          </Text>
        )}
      </ScrollView>
      <View
        className="flex-row gap-2 border-t border-border bg-surface px-4 pt-3 pb-[var(--footer-bottom-padding)]"
        style={vars({
          "--footer-bottom-padding": Math.max(insets.bottom, MINIMUM_FOOTER_BOTTOM_PADDING),
        })}
      >
        {onBack === undefined ? null : (
          <View className="flex-1">
            <Button fullWidth haptic="select" variant="secondary" onPress={onBack}>
              {GOAL_QUESTIONNAIRE.backAction}
            </Button>
          </View>
        )}
        <View className="flex-[2]">
          <Button disabled={!isNextEnabled} fullWidth haptic="select" onPress={onNext}>
            {nextLabel}
          </Button>
        </View>
      </View>
    </View>
  );
}
