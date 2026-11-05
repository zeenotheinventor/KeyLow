import { View } from "react-native";

import { Button, Text } from "../../ui";
import { HeatTile } from "../HeatTile";
import { LastTrainedBlock } from "../LastTrainedBlock";
import { StatTile } from "../StatTile";

import type { NotTrainedSheetBodyProps } from "./types";

/**
 * What the sheet of a muscle with no sets this week holds under its header: the Heat and This week tiles,
 * what a set would do, when the muscle was last trained, and how to get it into the routine. The Edit
 * routine button sits between the last two and is drawn only when its handler is given.
 */
export function NotTrainedSheetBody({ copy, detail, onEditRoutine }: NotTrainedSheetBodyProps) {
  const { heat, thisWeek, explanation, lastTrained, footnote, actions } = copy;

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
      {onEditRoutine === undefined ? null : (
        <Button fullWidth variant="secondary" onPress={onEditRoutine}>
          {actions.editRoutine}
        </Button>
      )}
      <Text tone="muted" variant="caption">
        {footnote}
      </Text>
    </>
  );
}
