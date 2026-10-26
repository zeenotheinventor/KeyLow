import {
  PLATE,
  describeFoodCount,
  describeLogPlateAction,
  describeLogPlateActionName,
  UNDO_LABEL,
} from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { useIsOnline } from "../../../../lib/connectivity";
import { withLogContext } from "../../../../lib/navigation";
import { useLogPlate, usePlate } from "../../../../lib/plate";
import { logRecipePath } from "../../../../lib/recipeRoutes";
import { Banner, Button, GroupedList, SheetScrollView, Text, TimeRow, useToast } from "../../../ui";
import { PlateSheetRow } from "../PlateSheetRow";
import { PlateTotalsCard } from "../PlateTotalsCard";

import type { PlateSheetContentProps } from "./types";
import type { PlateItem } from "@keylow/core/plate";

const ROWS_LABEL = "Foods on your plate";

/**
 * What Your plate holds while it is open: the heading with the count and Clear plate, the rows with their
 * amounts, the totals, the plate's one Time row and Log foods. The rows and the totals scroll, so a long plate
 * never pushes the Time row or Log foods off the screen. Clear plate acts at once, closes the sheet and says so
 * in a toast whose Undo puts the plate back, rows, amounts and time. While the plate is logged, Clear plate and
 * the Time row are dimmed and do nothing. When the plate cannot be logged, the sheet's error sentence shows
 * above them and the sheet stays open. It is mounted only while the sheet is, so the sentence is gone the next
 * time the sheet opens. A row's name opens the portion picker on that row, to change its unit; it is dimmed
 * while the connection is lost, because the picker reads the food's portions.
 */
export function PlateSheetContent({
  onClose,
  context,
  time,
  isNow,
  isTimePickerOpen,
  onOpenTime,
}: PlateSheetContentProps) {
  const { items, count, canLog, isLogging, setQuantity, remove, clear, restore } = usePlate();
  const { logPlate } = useLogPlate(context);
  const toast = useToast();
  const router = useRouter();
  const isOnline = useIsOnline();
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

  function openRow(item: PlateItem) {
    const path =
      item.kind === "recipe" ? logRecipePath(item.recipe.id) : `/foods/${item.foodId}/log`;
    router.push(withLogContext(path, context, { plate: item.key }));
  }

  function clearThePlate() {
    clear();
    // An empty plate has nothing to show, so the sheet goes with it, and the toast is where Undo is.
    onClose();
    toast.show({ message: PLATE.cleared, icon: "X", actionLabel: UNDO_LABEL, onAction: restore });
  }

  return (
    <View className="flex-1 gap-3">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-baseline gap-2">
          <Text role="heading" variant="h2">
            {PLATE.title}
          </Text>
          <Text tone="muted" variant="caption">
            {describeFoodCount(count)}
          </Text>
        </View>
        {/* The label's end lines up with the sheet's edge, as the board draws it. */}
        <Button
          className="-mr-2"
          disabled={isLogging}
          size="sm"
          tone="danger"
          variant="ghost"
          onPress={clearThePlate}
        >
          {PLATE.clear}
        </Button>
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
              isOpenDisabled={!isOnline}
              item={item}
              onAmountChange={(text) => {
                setQuantity(item.key, text);
              }}
              onOpen={() => {
                openRow(item);
              }}
              onRemove={() => {
                removeFood(item.key);
              }}
            />
          ))}
        </GroupedList>
        <PlateTotalsCard day={context.day} />
      </SheetScrollView>
      <TimeRow
        disabled={isLogging}
        isNow={isNow}
        open={isTimePickerOpen}
        time={time}
        onPress={onOpenTime}
      />
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
