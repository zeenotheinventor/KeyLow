import { View } from "react-native";

import { Text } from "../../ui";
import { HeatTile } from "../HeatTile";
import { LastTrainedBlock } from "../LastTrainedBlock";
import { StatTile } from "../StatTile";

import type { NotTargetedSheetBodyProps } from "./types";

/**
 * What the sheet of a muscle with no target holds under its header: the Heat and This week tiles, why there
 * is no target, when the muscle was last trained, and what would give it one. The Edit routine and Edit goal
 * buttons the board draws between the last two are not here until the routine editor and the goal screen
 * can be opened from the sheet.
 */
export function NotTargetedSheetBody({ copy, detail }: NotTargetedSheetBodyProps) {
  const { heat, thisWeek, explanation, lastTrained, footnote } = copy;

  return (
    <>
      <View className="flex-row gap-2">
        <HeatTile heat={heat} step={detail.heatStep} />
        <StatTile
          caption={thisWeek.statusName}
          label={thisWeek.label}
          swatchClassName="border border-border-strong bg-volume-not-targeted"
          value={thisWeek.value}
        />
      </View>
      <Text>{explanation}</Text>
      <LastTrainedBlock lastTrained={lastTrained} />
      <Text tone="muted" variant="caption">
        {footnote}
      </Text>
    </>
  );
}
