import type { LogEntry } from "@keylow/api-client";
import type { HourGroup } from "@keylow/core/diary";

export type FoodLogProps = {
  /** The day shown, `YYYY-MM-DD`. The complete switch is keyed by it. */
  localDate: string;
  /** All 24 hours, from core's `groupEntriesByHour`. */
  hours: readonly HourGroup<LogEntry>[];
  timeZone: string;
  /** The hour on the clock now, 0 to 23: where an empty day scrolls to. */
  currentHour: number;
  /** The diary shows today, so the current hour's chip carries the dot. */
  isToday: boolean;
  /** The day is marked complete. */
  isComplete: boolean;
  /** Yesterday has nothing to copy, as the empty day's card says. */
  isYesterdayEmpty: boolean;
  isCopying: boolean;
  hasCopyFailed: boolean;
  /** Called with the hour of the plus that was pressed. */
  onAddFood: (hour: number) => void;
  onEdit: (entryId: string) => void;
  onDelete: (entry: LogEntry) => void;
  onCopyYesterday: () => void;
  /** Called with the state the Mark day complete switch asks for. */
  onCompleteChange: (isComplete: boolean) => void;
};
