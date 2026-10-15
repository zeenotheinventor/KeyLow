import { DATE_PICKER, describeDatePickerMonth } from "@keylow/core/copy";
import { addMonths, monthOf, monthWeeks } from "@keylow/core/dates";
import { View } from "react-native";

import { IconButton } from "../IconButton";
import { Text } from "../Text";
import { DateCell } from "./DateCell";

import type { DatePickerProps } from "./types";

/**
 * A month calendar, as the date picker board draws it inside a sheet: the month between the previous and next
 * month buttons, a row of weekday letters from Monday, and a 44 point cell for each day. Today is ringed, the
 * chosen day is filled, complete days carry a success dot and say complete in their name, and days after today
 * are disabled. The next month button stops at the month of today. It holds no state and fetches nothing: the
 * screen owns the month and passes the complete days in.
 */
export function DatePicker({
  month,
  onMonthChange,
  selectedDate,
  today,
  completeDates,
  onSelect,
}: DatePickerProps) {
  const monthName = describeDatePickerMonth(month);
  const firstOfMonth = `${month}-01`;

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <IconButton
          icon="ChevronLeft"
          label={DATE_PICKER.previousMonth}
          variant="ghost"
          onPress={() => {
            onMonthChange(monthOf(addMonths(firstOfMonth, -1)));
          }}
        />
        <Text role="heading" variant="h2">
          {monthName}
        </Text>
        <IconButton
          disabled={month >= monthOf(today)}
          icon="ChevronRight"
          label={DATE_PICKER.nextMonth}
          variant="ghost"
          onPress={() => {
            onMonthChange(monthOf(addMonths(firstOfMonth, 1)));
          }}
        />
      </View>
      {/* The letters repeat what each cell's name already says, so a screen reader skips them. */}
      <View aria-hidden className="flex-row">
        {DATE_PICKER.weekdays.map(({ letter }, index) => (
          // The letters repeat (T, S), so a position is the only key.
          <Text key={index} className="flex-1 py-1 text-center" tone="muted" variant="caption">
            {letter}
          </Text>
        ))}
      </View>
      <View aria-label={monthName} className="gap-[2px]" role="grid">
        {monthWeeks(month).map((week) => (
          // A row is not an accessibility element, or the cells in it could not be reached, so it carries an id.
          <View
            key={week.find((day) => day !== null) ?? month}
            className="flex-row"
            role="row"
            testID="week-row"
          >
            {week.map((localDate, column) => (
              <View
                // A blank has no date, so its place in the week keeps it.
                key={localDate ?? `blank-${column}`}
                className="flex-1 items-center"
              >
                {localDate === null ? null : (
                  <DateCell
                    isComplete={completeDates.includes(localDate)}
                    isFuture={localDate > today}
                    isSelected={localDate === selectedDate}
                    isToday={localDate === today}
                    localDate={localDate}
                    onPress={() => {
                      onSelect(localDate);
                    }}
                  />
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
