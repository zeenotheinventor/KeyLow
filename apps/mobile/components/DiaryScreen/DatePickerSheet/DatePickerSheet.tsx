import { useCompleteDays } from "@keylow/api-client";
import { DAY_STEPPER } from "@keylow/core/copy";
import { monthOf } from "@keylow/core/dates";
import { useState } from "react";

import { BottomSheet, DatePicker } from "../../ui";

import type { DatePickerSheetProps } from "./types";

/**
 * The calendar button's sheet: the date picker in a bottom sheet named "Choose a date", opening on the
 * month of the day on view each time. The complete days it dots are read for the month shown, and only
 * while the sheet is open and the terms are accepted.
 */
export function DatePickerSheet({
  open,
  onClose,
  selectedDate,
  today,
  isReadEnabled,
  onSelect,
}: DatePickerSheetProps) {
  const [month, setMonth] = useState(monthOf(selectedDate));
  const [wasOpen, setWasOpen] = useState(open);
  const completeDays = useCompleteDays(month, { enabled: isReadEnabled && open });

  // Each opening starts on the month of the day on view, not on one an earlier opening paged to.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMonth(monthOf(selectedDate));
    }
  }

  return (
    // The board draws no title: the month in the picker is the heading. The sheet is named for a screen reader.
    <BottomSheet label={DAY_STEPPER.chooseDate} open={open} onClose={onClose}>
      <DatePicker
        completeDates={completeDays.data ?? []}
        month={month}
        selectedDate={selectedDate}
        today={today}
        onMonthChange={setMonth}
        onSelect={onSelect}
      />
    </BottomSheet>
  );
}
