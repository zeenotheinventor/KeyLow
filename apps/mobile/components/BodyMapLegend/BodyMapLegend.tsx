import { BODY_MAP, BODY_MAP_LEGEND_ITEMS, describeLegendCaption } from "@keylow/core/copy";
import { COMPARE_PARAMS_V1 } from "@keylow/core/training";
import { View } from "react-native";

import { heatSwatchClassNames } from "../HeatSwatch";
import { Text } from "../ui";

import type { BodyMapLegendProps } from "./types";

// Each swatch is written next to its name, in the order of the boards, so a legend item can never be left
// without a colour. The names are core's `BODY_MAP_LEGEND_ITEMS` and the classes are written out so Tailwind
// sees them. The heat legend goes from the rested step up to the peak, with the classes every heat swatch
// shares, and only the peak glows. Volume starts with Not targeted, and Gap with Not in plan, which is drawn
// in the same colour.
const volumeSwatches = [
  "bg-volume-not-targeted",
  "bg-volume-under",
  "bg-volume-maintaining",
  "bg-volume-productive",
  "bg-volume-over",
] as const;
const gapSwatches = [
  "bg-volume-not-targeted",
  "bg-gap-behind",
  "bg-gap-on-plan",
  "bg-gap-ahead",
] as const;

const legendItems = {
  heat: BODY_MAP_LEGEND_ITEMS.heat.map((name, position) => ({
    name,
    swatchClassName: heatSwatchClassNames[position],
  })),
  volume: BODY_MAP_LEGEND_ITEMS.volume.map((name, position) => ({
    name,
    swatchClassName: volumeSwatches[position],
  })),
  gap: BODY_MAP_LEGEND_ITEMS.gap.map((name, position) => ({
    name,
    swatchClassName: gapSwatches[position],
  })),
};

/**
 * The key to the colours of a scale under the body map: a swatch and the name of each step, and a line on
 * what the colours mean. The swatches and their names are one group, named for the scale's legend, and the
 * line under it is read on its own.
 */
export function BodyMapLegend({ scale }: BodyMapLegendProps) {
  const caption = describeLegendCaption({
    scale,
    surface: "mobile",
    onPlanToleranceSets: COMPARE_PARAMS_V1.onPlanToleranceSets,
  });

  return (
    <View className="gap-[6px]">
      <View
        accessible
        aria-label={BODY_MAP.legendNames[scale]}
        className="flex-row gap-1"
        role="group"
      >
        {legendItems[scale].map(({ name, swatchClassName }) => (
          <View key={name} className="flex-1 items-center gap-1">
            <View aria-hidden className={`h-[10px] w-full rounded-[3px] ${swatchClassName}`} />
            <Text className="text-center" numberOfLines={1} tone="secondary" variant="caption">
              {name}
            </Text>
          </View>
        ))}
      </View>
      <Text className="text-center" tone="muted" variant="caption">
        {caption}
      </Text>
    </View>
  );
}
