import { MACRO_NAMES, describePlateDay } from "@keylow/core/copy";
import { formatCalories, formatGrams } from "@keylow/core/format";
import { View } from "react-native";

import { usePlate } from "../../../../lib/plate";
import { Card, MacroProgressStrip, Text } from "../../../ui";
import { usePlateDayBars } from "../../LogPlateStrip";

import type { PlateTotalsCardProps } from "./types";

// The classes are written out so Tailwind sees them.
const macroMarks = [
  { macro: "protein", totalKey: "protein_g", markClassName: "bg-protein" },
  { macro: "carbs", totalKey: "carbs_g", markClassName: "bg-carbs" },
  { macro: "fat", totalKey: "fat_g", markClassName: "bg-fat" },
] as const;

/**
 * What the plate comes to, and under a hairline what the day comes to with it: the same four bars the search
 * shows, drawn on the card. The bars wait, with their heading, for the day, its targets and the time zone.
 */
export function PlateTotalsCard({ day }: PlateTotalsCardProps) {
  const { totals } = usePlate();
  const dayBars = usePlateDayBars(day);

  return (
    <Card aria-label="Totals" padding={0}>
      <View className="gap-2 px-4 py-3">
        <View className="flex-row items-baseline justify-between">
          <Text variant="body-strong">On your plate</Text>
          <Text variant="body-strong">
            {formatCalories(totals.kcal)}
            <Text tone="muted" variant="caption">
              {" kcal"}
            </Text>
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-x-3 gap-y-[2px]">
          {macroMarks.map(({ macro, totalKey, markClassName }) => (
            <View key={macro} className="flex-row items-center gap-1">
              <View className={`h-[6px] w-[6px] rounded-[2px] ${markClassName}`} />
              <Text tone="secondary" variant="caption">
                {`${MACRO_NAMES[macro]} ${formatGrams(totals[totalKey])} g`}
              </Text>
            </View>
          ))}
        </View>
        {dayBars === undefined ? null : (
          <View className="mt-1 gap-2 border-t border-border pt-3">
            <Text tone="secondary" variant="caption">
              {describePlateDay(dayBars.dayTitle)}
            </Text>
            <MacroProgressStrip
              bars={dayBars.bars}
              label={describePlateDay(dayBars.dayTitle)}
              surface="card"
            />
          </View>
        )}
      </View>
    </Card>
  );
}
