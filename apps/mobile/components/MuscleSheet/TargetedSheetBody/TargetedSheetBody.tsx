import { View } from "react-native";

import { Text } from "../../ui";
import { WeeklySetsBar } from "../../WeeklySetsBar";
import { HeatTile } from "../HeatTile";
import { LastTrainedBlock } from "../LastTrainedBlock";
import { StatTile } from "../StatTile";

import type { TargetedSheetBodyProps } from "./types";

/**
 * What a targeted muscle's sheet holds under its header: the Heat and Ready tiles, the weekly sets block
 * with its bar, when the muscle was last trained, and the note on how sets are counted.
 */
export function TargetedSheetBody({ copy, detail }: TargetedSheetBodyProps) {
  const { heat, ready, weeklySets, lastTrained, weightingNote } = copy;

  return (
    <>
      <View className="flex-row gap-2">
        <HeatTile heat={heat} step={detail.heatStep} />
        <StatTile caption={ready.caption} label={ready.label} value={ready.value} />
      </View>
      <View className="gap-2">
        <View className="flex-row items-baseline justify-between gap-3">
          <Text tone="muted" variant="caption">
            {weeklySets.heading}
          </Text>
          <Text tone="secondary" variant="caption">
            {weeklySets.plannedText}
          </Text>
        </View>
        <View className="flex-row items-baseline gap-2">
          <Text variant="numeral-small">{weeklySets.done.value}</Text>
          <Text tone="secondary">{weeklySets.done.caption}</Text>
        </View>
        <WeeklySetsBar
          labels={weeklySets.barLabels}
          name={weeklySets.barName}
          weeklySets={detail.weeklySets}
        />
        <Text>{weeklySets.position}</Text>
      </View>
      <LastTrainedBlock lastTrained={lastTrained} />
      <Text tone="muted" variant="caption">
        {weightingNote}
      </Text>
    </>
  );
}
