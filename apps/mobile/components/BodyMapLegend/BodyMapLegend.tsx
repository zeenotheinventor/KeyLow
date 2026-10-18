import { BODY_MAP, BODY_MAP_LEGEND_ITEMS, describeLegendCaption } from "@keylow/core/copy";
import { COMPARE_PARAMS_V1 } from "@keylow/core/training";
import { View } from "react-native";

import { Text } from "../ui";

// The legend reads from the rested step up to the peak, as the board draws it, and only the peak glows. The
// classes are written out so Tailwind sees them.
const heatSwatchClassNames = [
  "bg-heat-0",
  "bg-heat-1",
  "bg-heat-2",
  "bg-heat-3",
  "bg-heat-4",
  "bg-heat-5 shadow-[0_0_8px_0] shadow-heat-glow",
];

/**
 * The key to the heat colours under the body map: a swatch and the name of each step, from Rested to Peak,
 * and a line on how heat is worked out. The swatches and their names are one group, named for the legend,
 * and the line under it is read on its own. The volume and gap legends come with their scales.
 */
export function BodyMapLegend() {
  const caption = describeLegendCaption({
    scale: "heat",
    surface: "mobile",
    onPlanToleranceSets: COMPARE_PARAMS_V1.onPlanToleranceSets,
  });

  return (
    <View className="gap-[6px]">
      <View
        accessible
        aria-label={BODY_MAP.legendNames.heat}
        className="flex-row gap-1"
        role="group"
      >
        {BODY_MAP_LEGEND_ITEMS.heat.map((stepName, step) => (
          <View key={stepName} className="flex-1 items-center gap-1">
            <View
              aria-hidden
              className={`h-[10px] w-full rounded-[3px] ${heatSwatchClassNames[step]}`}
            />
            <Text className="text-center" numberOfLines={1} tone="secondary" variant="caption">
              {stepName}
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
