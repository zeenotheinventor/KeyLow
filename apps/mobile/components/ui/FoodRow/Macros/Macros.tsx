import { FOOD_ROW } from "@keylow/core/copy";
import { View } from "react-native";

import { Icon } from "../../Icon";
import { Text } from "../../Text";

import type { MacrosProps } from "./types";

// The values sit beside a colour mark and are never coloured themselves, so the macro colour is a dot
// and the letters stay in a text colour (Q14). The classes are written out so Tailwind sees them.
const macroColumns = [
  { macro: "protein", letter: "P", dotClassName: "bg-protein" },
  { macro: "carbs", letter: "C", dotClassName: "bg-carbs" },
  { macro: "fat", letter: "F", dotClassName: "bg-fat" },
] as const;

// The flame is drawn at 12 points, a stroke heavier than the icons around it, as the boards draw it.
const flameSize = 12;
const flameStrokeWidth = 2;

/**
 * The protein, carbohydrate and fat line of a food row, in the order the boards draw it. With an
 * energy it is the stats line of the food log rows.
 */
export function Macros({ macros, basis, energy, needsReview = false }: MacrosProps) {
  // The stats line is the energy, the macros and the review flag. A food that needs review has the line
  // with no energy to show, so the flag alone is enough to make it one.
  const isStatsLine = energy !== undefined || needsReview;
  // A stats line with no macros to show says the food needs review. The plain line just has no marks.
  const showsReview = isStatsLine && (needsReview || macros === undefined);
  const shownMacros = showsReview ? undefined : macros;

  return (
    <View
      className={
        isStatsLine
          ? "flex-row flex-wrap items-center gap-x-[10px] gap-y-[2px]"
          : "flex-row items-center gap-[10px]"
      }
    >
      {energy === undefined ? null : (
        <View className="flex-row items-center gap-1">
          <Icon name="Flame" size={flameSize} strokeWidth={flameStrokeWidth} tone="calories" />
          <Text numberOfLines={1} tone="secondary" variant="caption">
            {energy}
          </Text>
          <Text numberOfLines={1} tone="muted" variant="caption">
            {FOOD_ROW.energyUnit}
          </Text>
        </View>
      )}
      {showsReview ? (
        <Text numberOfLines={1} tone="warning-ink" variant="caption">
          {FOOD_ROW.needsReview}
        </Text>
      ) : null}
      {shownMacros === undefined
        ? null
        : macroColumns.map(({ macro, letter, dotClassName }) => (
            <View key={macro} className="flex-row items-center gap-1">
              <View className={`h-[6px] w-[6px] rounded-[2px] ${dotClassName}`} />
              <Text numberOfLines={isStatsLine ? 1 : undefined} tone="secondary" variant="caption">
                {`${shownMacros[macro]} ${letter}`}
              </Text>
            </View>
          ))}
      {basis === undefined ? null : (
        <Text tone="muted" variant="caption">
          {basis}
        </Text>
      )}
    </View>
  );
}
