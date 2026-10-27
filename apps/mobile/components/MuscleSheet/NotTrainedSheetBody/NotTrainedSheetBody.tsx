import { View } from "react-native";

import { Text } from "../../ui";
import { HeatTile } from "../HeatTile";
import { LastTrainedBlock } from "../LastTrainedBlock";
import { StatTile } from "../StatTile";

import type { NotTrainedSheetBodyProps } from "./types";

/**
 * What the sheet of a muscle with no sets this week holds under its header: the Heat and This week tiles,
 * what a set would do, when the muscle was last trained, and how to get it into the routine. The Edit
 * routine button the board draws between the last two is not here until the routine editor can be opened
 * from the sheet.
 */
export function NotTrainedSheetBody({ copy, detail }: NotTrainedSheetBodyProps) {
  const { heat, thisWeek, explanation, lastTrained, footnote } = copy;

  return (
    <>
      <View className="flex-row gap-2">
        <HeatTile heat={heat} step={detail.heatStep} />
        <StatTile
          caption={thisWeek.statusName}
          label={thisWeek.label}
          swatchClassName="border border-border-strong bg-volume-not-trained"
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
