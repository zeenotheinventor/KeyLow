import { useCompleteDays } from "@keylow/api-client";
import { monthOf } from "@keylow/core/dates";
import { useState } from "react";

import type { CompleteDaysPickerProps } from "./types";

import { DatePicker } from "@/components/ui/DatePicker";

/**
 * The date picker with a dot on each complete day of the month it shows, read from the diary. Render it
 * only while it is open: the complete days are read while it is mounted, and again for each month it
 * moves to.
 */
export function CompleteDaysPicker({
  selectedDate,
  today,
  opener,
  onSelectDate,
  onClose,
  className,
}: CompleteDaysPickerProps) {
  const [month, setMonth] = useState(monthOf(selectedDate));
  const completeDays = useCompleteDays(month);

  return (
    <DatePicker
      className={className}
      selectedDate={selectedDate}
      today={today}
      completeDays={completeDays.data ?? []}
      opener={opener}
      onMonthChange={setMonth}
      onSelectDate={onSelectDate}
      onClose={onClose}
    />
  );
}
