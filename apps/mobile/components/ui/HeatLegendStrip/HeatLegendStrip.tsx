import { BODY_MAP } from "@keylow/core/copy";
import { View } from "react-native";

import { Text } from "../Text";

// From the peak down to rested, and only the peak glows. The classes are written out so Tailwind sees them.
const heatSwatchClassNames = [
  "bg-heat-5 shadow-[0_0_6px_0] shadow-heat-glow",
  "bg-heat-4",
  "bg-heat-3",
  "bg-heat-2",
  "bg-heat-1",
  "bg-heat-0",
];

/**
 * The heat legend as the small body map cards draw it beside the figures: six swatches in a column from Peak
 * at the top down to Rested, with the names of the two ends. It is one image named for the heat legend.
 */
export function HeatLegendStrip() {
  return (
    <View
      accessible
      aria-label={BODY_MAP.legendNames.heat}
      className="items-start gap-[3px] pb-[6px]"
      role="img"
    >
      <Text tone="muted" variant="caption">
        {BODY_MAP.dashboardCard.hottestStep}
      </Text>
      {heatSwatchClassNames.map((swatchClassName) => (
        <View
          key={swatchClassName}
          className={`h-[14px] w-[10px] rounded-[3px] ${swatchClassName}`}
        />
      ))}
      <Text tone="muted" variant="caption">
        {BODY_MAP.dashboardCard.coolestStep}
      </Text>
    </View>
  );
}
