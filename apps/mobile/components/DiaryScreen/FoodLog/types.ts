import type { LogEntry } from "@keylow/api-client";
import type { HourGroup } from "@keylow/core/diary";

export type FoodLogProps = {
  /** All 24 hours, from core's `groupEntriesByHour`. */
  hours: readonly HourGroup<LogEntry>[];
  timeZone: string;
  /** The hour on the clock now, 0 to 23: where an empty day scrolls to. */
  currentHour: number;
  /** The diary shows today, so the current hour's chip carries the dot. */
  isToday: boolean;
  isOnline: boolean;
  /** The day is marked complete. */
  isComplete: boolean;
  /** Yesterday has nothing to copy, as the empty day's card says. */
  isYesterdayEmpty: boolean;
  /** A copy of yesterday is under way, as the empty day's button shows. */
  isCopying: boolean;
  /** Called with the hour of the plus that was pressed. */
  onAddFood: (hour: number) => void;
  /** Called with the entry whose row was deleted, by a swipe or by its Delete action. Rows cannot be deleted while offline. */
  onDeleteEntry: (entry: LogEntry) => void;
  /** Copies yesterday's whole day, from the empty day's button. */
  onCopyYesterday: () => void;
  /**
   * Saves the day as complete or not, with the state the switch would move to. It rejects when the save
   * fails, and the switch is then made new, so that its press cannot play the moment for a later sync.
   */
  onCompleteChange: (complete: boolean) => Promise<void>;
};
