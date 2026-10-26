import {
  PLATE,
  describeFoodCount,
  describeLogPlateAction,
  describeLogPlateActionName,
} from "@keylow/core/copy";
import { useState } from "react";
import { View } from "react-native";

import { useLogPlate, usePlate } from "../../../../lib/plate";
import { Banner, Button, GroupedList, SheetScrollView, Text } from "../../../ui";
import { PlateSheetRow } from "../PlateSheetRow";
import { PlateTotalsCard } from "../PlateTotalsCard";

import type { PlateSheetContentProps } from "./types";

const ROWS_LABEL = "Foods on your plate";

/**
 * What Your plate holds while it is open: the heading with the count, the rows with their amounts, the totals
 * and Log foods. The rows and the totals scroll, so a long plate never pushes Log foods off the screen. When
 * the plate cannot be logged, the sheet's error sentence shows above them and the sheet stays open. It is
 * mounted only while the sheet is, so the sentence is gone the next time the sheet opens.
 */
export function PlateSheetContent({ onClose, context }: PlateSheetContentProps) {
  const { items, count, canLog, isLogging, setQuantity, remove } = usePlate();
  const { logPlate } = useLogPlate(context);
  const [hasFailed, setHasFailed] = useState(false);

  function logTheFoods() {
    setHasFailed(false);
    void logPlate().then((result) => {
      if (!result.ok && result.wasIgnored !== true) {
        setHasFailed(true);
      }
    });
  }

  function removeFood(key: string) {
    remove(key);
    // An empty plate has nothing to show, so the sheet goes with its last food.
    if (count === 1) {
      onClose();
    }
  }

  return (
    <View className="flex-1 gap-3">
      <View className="flex-row items-baseline gap-2">
        <Text role="heading" variant="h2">
          {PLATE.title}
        </Text>
        <Text tone="muted" variant="caption">
          {describeFoodCount(count)}
        </Text>
      </View>
      {hasFailed ? <Banner sentence title={PLATE.notLogged} variant="error" /> : null}
      <SheetScrollView
        className="flex-1"
        contentContainerClassName="gap-3"
        keyboardShouldPersistTaps="handled"
      >
        <GroupedList hidesTitle label={ROWS_LABEL} title={ROWS_LABEL}>
          {items.map((item) => (
            <PlateSheetRow
              key={item.key}
              isDisabled={isLogging}
              item={item}
              onAmountChange={(text) => {
                setQuantity(item.key, text);
              }}
              onRemove={() => {
                removeFood(item.key);
              }}
            />
          ))}
        </GroupedList>
        <PlateTotalsCard day={context.day} />
      </SheetScrollView>
      <Button
        accessibilityLabel={describeLogPlateActionName(count)}
        disabled={!canLog && !isLogging}
        fullWidth
        loading={isLogging}
        size="lg"
        onPress={logTheFoods}
      >
        {describeLogPlateAction(count)}
      </Button>
    </View>
  );
}
