import { describeMoveStep, describeStepRowName } from "@keylow/core/copy";
import { Text as NativeText, View } from "react-native";

import { rowPressScale } from "../../lib/motion";
import { Icon, IconButton, PressableSurface, Text, useGroupedRowPosition } from "../ui";

import type { StepRowProps } from "./types";

/**
 * One step of a recipe's method: the number in a circle and the full text beside it. It sits in a
 * `GroupedList`, which tells it whether it is the first row. The recipe view's row is read only. The
 * editor's row opens the step when pressed and ends in a chevron, and in Reorder mode the chevron gives way
 * to the two move buttons and the row stops opening.
 */
export function StepRow({ number, text, onPress, reorder, moveUpRef, moveDownRef }: StepRowProps) {
  const { isFirst } = useGroupedRowPosition();

  const rowClassName = `min-h-[52px] flex-row items-center gap-3 p-3 ${isFirst ? "" : "border-t border-border"}`;

  const numberAndText = (
    <View className="min-w-0 flex-1 flex-row items-start gap-3">
      <View className="h-6 w-6 shrink-0 items-center justify-center rounded-pill border border-border bg-surface-raised">
        {/* The board draws the number at weight 600 over 12 points, which no kit text variant is, so it is written as the toast's action is. */}
        <NativeText className="text-[12px] font-semibold leading-4 tabular-nums text-text-primary">
          {number}
        </NativeText>
      </View>
      <Text className="min-w-0 flex-1">{text}</Text>
    </View>
  );

  if (reorder !== undefined) {
    return (
      // The number and the step read as one thing, and the buttons beside it are reached on their own.
      <View className={`${rowClassName} pr-1 ${reorder.isHighlighted ? "bg-accent-muted" : ""}`}>
        <View accessible className="min-w-0 flex-1">
          {numberAndText}
        </View>
        <View className="shrink-0 flex-row">
          <IconButton
            disabled={!reorder.canMoveUp}
            icon="ChevronUp"
            label={describeMoveStep(number, "up")}
            ref={moveUpRef}
            variant="ghost"
            onPress={reorder.onMoveUp}
          />
          <IconButton
            disabled={!reorder.canMoveDown}
            icon="ChevronDown"
            label={describeMoveStep(number, "down")}
            ref={moveDownRef}
            variant="ghost"
            onPress={reorder.onMoveDown}
          />
        </View>
      </View>
    );
  }

  if (onPress !== undefined) {
    return (
      <PressableSurface
        className={rowClassName}
        label={describeStepRowName(number, text)}
        pressScale={rowPressScale}
        onPress={onPress}
      >
        {numberAndText}
        <Icon name="ChevronRight" size="sm" tone="muted" />
      </PressableSurface>
    );
  }

  return (
    // One element for a screen reader, which reads the number and then the step.
    <View accessible className={rowClassName}>
      {numberAndText}
    </View>
  );
}
