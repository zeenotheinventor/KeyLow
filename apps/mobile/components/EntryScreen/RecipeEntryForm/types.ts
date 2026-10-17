import type { RecipeLogEntry } from "@keylow/api-client";

export type RecipeEntryFormProps = {
  /** The latest row of the entry, which a save passes on as it is. */
  entry: RecipeLogEntry;
  /** The profile's IANA time zone, which the entry's time is read and written in. */
  timeZone: string;
  /** Leaves the screen: after a save, a delete, or Back. */
  onLeave: () => void;
};
