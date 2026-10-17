import type { WeekDayMarker } from "@keylow/core/diary";

export type DayMarkersProps = {
  /** The seven days, Monday to Sunday, from core's `weekSummary`. */
  markers: readonly WeekDayMarker[];
};
