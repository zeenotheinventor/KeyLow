import type { LogEntry } from "@keylow/api-client";
import type { HourGroup } from "@keylow/core/diary";
import type { Ref } from "react";

export type FoodLogProps = {
  /** The log's element, so the screen can find a control in it to give focus to. */
  ref?: Ref<HTMLDivElement> | undefined;
  /** All 24 hours, from core's `groupEntriesByHour`. */
  hours: readonly HourGroup<LogEntry>[];
  timeZone: string;
  /** The hour on the clock now, 0 to 23: where an empty day scrolls to. */
  currentHour: number;
  /** The diary shows today, so the current hour's chip carries the dot. */
  isToday: boolean;
  /** The day is marked complete. */
  isComplete: boolean;
  /** The app can reach the server. Offline, the hour plus, Delete, Copy yesterday and the complete switch are off. */
  isOnline: boolean;
  /** Yesterday has nothing to copy, as the empty day's card says. */
  isYesterdayEmpty: boolean;
  isCopying: boolean;
  hasCopyFailed: boolean;
  /** Called with the hour (0 to 23) when its plus is pressed. */
  onAddFood: (hour: number) => void;
  onEdit: (entry: LogEntry) => void;
  onDelete: (entry: LogEntry) => void;
  onCopyYesterday: () => void;
  /** Called with the state the Mark day complete switch asks for. */
  onCompleteChange: (isComplete: boolean) => void;
};
