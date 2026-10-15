import type { FoodLogEntry } from "@keylow/api-client";

export type FoodEntryFormProps = {
  /** The latest row of the entry, which a save passes on as it is. */
  entry: FoodLogEntry;
  /** The profile's IANA time zone, which the entry's time is read and written in. */
  timeZone: string;
  /** Leaves the screen: after a save, a delete, or Back. */
  onLeave: () => void;
};
