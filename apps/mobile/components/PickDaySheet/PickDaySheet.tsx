import { TRAIN_PICK_DAY, describePickDayRow } from "@keylow/core/copy";
import { View } from "react-native";

import { BottomSheet, GroupedList, ListRow, SheetHeader, SheetScrollView } from "../ui";

import type { PickDaySheetProps } from "./types";

// A routine holds at most seven days, which fit at this height with the header. A shorter phone scrolls them.
const SNAP_POINTS = ["60%"];

/**
 * The sheet Pick day opens: the active routine's days in routine order, each with its name, load and weekday.
 * Pressing a day hands its id to `onPick` and nothing more: the screen starts the session and closes the
 * sheet once the card no longer offers Pick day. No board draws it (KEY-505), so it is built from the kit:
 * a bottom sheet with the sheet header over a grouped list of rows.
 */
export function PickDaySheet({
  open,
  onClose,
  days,
  startingDayId,
  isDisabled,
  onPick,
}: PickDaySheetProps) {
  return (
    <BottomSheet
      label={TRAIN_PICK_DAY.sheetTitle}
      open={open}
      snapPoints={SNAP_POINTS}
      onClose={onClose}
    >
      {/* The header brings its own 16 points across, as the sheet does, so it is pulled out to the sheet's edge. */}
      <View className="-mx-4">
        <SheetHeader
          leading={{ icon: "X", label: TRAIN_PICK_DAY.closeName, onPress: onClose }}
          title={TRAIN_PICK_DAY.sheetTitle}
        />
      </View>
      <SheetScrollView className="flex-1" contentContainerClassName="pb-2">
        <GroupedList hidesTitle title={TRAIN_PICK_DAY.sheetTitle}>
          {days.map((day) => {
            const row = describePickDayRow(day);
            const isStarting = day.id === startingDayId;
            return (
              <ListRow
                key={day.id}
                disabled={isDisabled && !isStarting}
                loading={isStarting}
                subtitle={row.meta}
                title={row.title}
                value={row.weekdayLabel}
                valueLook="quiet"
                onPress={() => {
                  onPick(day.id);
                }}
              />
            );
          })}
        </GroupedList>
      </SheetScrollView>
    </BottomSheet>
  );
}
