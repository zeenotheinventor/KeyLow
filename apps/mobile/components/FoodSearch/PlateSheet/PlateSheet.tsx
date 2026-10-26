import { PLATE } from "@keylow/core/copy";
import { useState } from "react";

import { PlateSheetContent } from "./PlateSheetContent";
import { usePlateClockTime } from "./usePlateClockTime";
import { usePlate } from "../../../lib/plate";
import { BottomSheet, TimePicker } from "../../ui";

import type { PlateSheetProps } from "./types";

// The board draws the sheet from just under the header to the bottom. The rows can outgrow any height, so it
// is a fixed height sheet and its rows scroll.
const SNAP_POINTS = ["87%"];

/**
 * "Your plate": the sheet the plate chip opens, where what is on the plate is edited before it is logged. It
 * draws over the search, which it dims, and closes on the dim, a drag down and the Android back button with the
 * plate kept. While the plate is being logged it stays, so the answer, good or bad, is seen. The time picker the
 * Time row opens is a sheet of its own, drawn after this one so it covers it, which the plate sheet stays under.
 */
export function PlateSheet({ open, onClose, context }: PlateSheetProps) {
  const { isLogging, count, setTime } = usePlate();
  const { time, isNow } = usePlateClockTime();
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

  // The picker goes with the sheet it was opened from.
  if (!open && isTimePickerOpen) {
    setIsTimePickerOpen(false);
  }

  return (
    <>
      <BottomSheet
        isDismissible={!isLogging}
        label={PLATE.title}
        open={open}
        snapPoints={SNAP_POINTS}
        onClose={() => {
          if (!isLogging) {
            onClose();
          }
        }}
      >
        {/* Without a food there is nothing to show, so the sheet closing on its last food never reads "0 foods". */}
        {count === 0 ? null : (
          <PlateSheetContent
            context={context}
            isNow={isNow}
            isTimePickerOpen={isTimePickerOpen}
            time={time}
            onClose={onClose}
            onOpenTime={() => {
              setIsTimePickerOpen(true);
            }}
          />
        )}
      </BottomSheet>
      <TimePicker
        open={isTimePickerOpen}
        value={time}
        onChange={(next) => {
          setTime({ isNow: false, time: next });
        }}
        onClose={() => {
          setIsTimePickerOpen(false);
        }}
      />
    </>
  );
}
