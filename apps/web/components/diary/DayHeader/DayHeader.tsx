import { DIARY_VIEW } from "@keylow/core/copy";

import { ChooseDate } from "../ChooseDate";

import type { DayHeaderProps } from "./types";

import { SegmentedControl } from "@/components/ui/SegmentedControl";

const VIEW_OPTIONS = [
  { value: "day", label: DIARY_VIEW.day },
  { value: "week", label: DIARY_VIEW.week },
] as const;

/**
 * The top of the diary, as the board draws it: the title (Today, or the day) with the calendar button
 * that opens the date picker, and the Day | Week control. The week view draws the day stepper it is given
 * in their place, and the control stays.
 */
export function DayHeader({
  title,
  selectedDate,
  today,
  view,
  weekStepper,
  onSelectDate,
  onViewChange,
}: DayHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      {view === "day" && (
        <div className="relative flex items-center gap-3">
          <h1 className="text-h1">{title}</h1>
          <ChooseDate selectedDate={selectedDate} today={today} onSelectDate={onSelectDate} />
        </div>
      )}
      {view === "week" && weekStepper}
      <SegmentedControl
        label={DIARY_VIEW.label}
        options={VIEW_OPTIONS}
        value={view}
        onChange={onViewChange}
        className="w-full md:ml-auto md:w-[200px]"
      />
    </div>
  );
}
