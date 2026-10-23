import { describeMuscleListRow } from "@keylow/core/copy";
import { View } from "react-native";

import { rowPressScale } from "../../lib/motion";
import { heatSwatchClassNames } from "../HeatSwatch";
import { Icon, PressableSurface, Text, useGroupedRowPosition } from "../ui";

import type { MuscleRowProps } from "./types";

/**
 * One muscle of the muscle list, as `body · muscle-list` draws it: a 16 point swatch in the colour of its
 * heat step, the name over "Rested · ready now", the percent, and a chevron. The whole row is one button
 * that opens the muscle's sheet, named in words ("Hamstrings, heat 55 percent, hot, ready in 31 hours, open
 * details"), so the swatch's colour is never the only way to read the heat. A row in a `GroupedList` has the
 * hairline above it, except the first.
 */
export function MuscleRow({ row, onPress }: MuscleRowProps) {
  const { isFirst } = useGroupedRowPosition();
  const { name, status, heatText, accessibleName } = describeMuscleListRow(row);

  return (
    <PressableSurface
      className={`min-h-[60px] flex-row items-center gap-3 px-3 py-2 ${isFirst ? "" : "border-t border-border"}`}
      label={accessibleName}
      pressScale={rowPressScale}
      onPress={onPress}
    >
      <View
        aria-hidden
        className={`h-4 w-4 shrink-0 rounded-[4px] ${heatSwatchClassNames[row.heatStep]}`}
      />
      <View className="min-w-0 flex-1 gap-[2px]">
        <Text>{name}</Text>
        <Text tone="secondary" variant="caption">
          {status}
        </Text>
      </View>
      <Text className="shrink-0" variant="body-strong">
        {heatText}
      </Text>
      <Icon name="ChevronRight" size="sm" tone="muted" />
    </PressableSurface>
  );
}
