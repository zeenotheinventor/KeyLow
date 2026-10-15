import { describeAddFoodAtHour, describeHourChip, describeHourGroup } from "@keylow/core/copy";
import { View } from "react-native";

import { Card } from "../Card";
import { GroupedRowPositionContext, positionedRows } from "../GroupedList";
import { IconButton } from "../IconButton";
import { Text } from "../Text";

import type { HourRowProps } from "./types";

// The chip is a fixed 28 points high, so its text stops growing with the device's font size where it
// would no longer fit inside, as the week strip's pills do.
const maxFontScale = 1.2;

/**
 * One hour of the food log: a chip with the hour, a quiet plus to add food at that hour, a guide line
 * down the left that the hours' rows join into one line, and the hour's foods in a card under the chip.
 * It is a list item, so the screen puts the 24 rows in a `role="list"`. The foods are its children, and
 * the screen measures a row with `onLayout`, because an hour's height depends on how many foods it holds.
 * The numbers are the diary board's: the line 6 in from the edge and 14 of padding after it, a 7 point
 * node on the line, and the chip and the card 8 past the padding.
 */
export function HourRow({
  hour,
  label,
  isNow = false,
  addDisabled = false,
  onAdd,
  onLayout,
  children,
}: HourRowProps) {
  const foods = positionedRows(children);

  return (
    // The row carries a label because it names the hour group for a screen reader, such as "08:00, 2 foods" or
    // "09:00, nothing logged", which is what a list of 24 hours is read as. It is not `accessible`, though:
    // the plus and the foods inside are buttons, which an accessible wrapper would fold away.
    <View
      aria-label={describeHourGroup(label, foods.length)}
      className="ml-[6px] border-l border-border pl-[14px]"
      role="listitem"
      onLayout={onLayout}
    >
      <View
        aria-hidden
        className="absolute -left-[4px] top-[19px] h-[7px] w-[7px] rounded-pill border border-border-strong bg-surface-raised"
      />
      <View className="min-h-touch-target flex-row items-center justify-between">
        {/* The dot is decoration, so the chip's name says "now" in words. */}
        <View
          accessible
          aria-label={describeHourChip(label, isNow)}
          className="ml-2 h-[28px] flex-row items-center gap-[6px] rounded-pill border border-border bg-surface-raised px-3"
        >
          <Text maxFontSizeMultiplier={maxFontScale} tone="secondary" variant="caption">
            {label}
          </Text>
          {isNow ? <View aria-hidden className="h-[6px] w-[6px] rounded-pill bg-accent" /> : null}
        </View>
        <IconButton
          disabled={addDisabled}
          icon="Plus"
          label={describeAddFoodAtHour(label)}
          variant="ring"
          onPress={() => {
            onAdd(hour);
          }}
        />
      </View>
      {foods.length === 0 ? null : (
        <View className="mb-2 ml-2">
          {/* The foods bring their own padding, so the card has none. */}
          <Card padding={0}>
            {foods.map((food) => (
              <GroupedRowPositionContext key={food.key} value={food.position}>
                {food.node}
              </GroupedRowPositionContext>
            ))}
          </Card>
        </View>
      )}
    </View>
  );
}
