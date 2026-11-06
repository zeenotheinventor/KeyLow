import type { PlateItem, PlateTime, PlateTotals } from "@keylow/core/plate";
import type { ReactNode } from "react";

/** Builds the item a screen adds, given the key the plate has minted for its row. */
export type PlateItemBuilder = (key: string) => PlateItem;

export type PlateContextValue = {
  items: readonly PlateItem[];
  /** How many rows are on the plate. */
  count: number;
  totals: PlateTotals;
  /** Puts an item on the plate (it merges into the same food or recipe in the same unit). */
  add: (build: PlateItemBuilder) => void;
  /** Sets what a row's amount field holds. */
  setQuantity: (key: string, text: string) => void;
  remove: (key: string) => void;
  /** Empties the plate, keeping what was on it for `restore`. */
  clear: () => void;
  /** Puts back what `clear` took away. */
  restore: () => void;
  time: PlateTime;
  setTime: (time: PlateTime) => void;
  /** The plate is being written. The dialog dims its pluses, chip, Cancel and Close and ignores Escape. */
  isLogging: boolean;
  /**
   * Marks the plate as being logged and says whether the caller may go on. It is false when a log is already
   * running, which is told in the same tick, before any render.
   */
  startLogging: () => boolean;
  /** Marks the log as over, so a failed log can be tried again. */
  finishLogging: () => void;
};

export type PlateProviderProps = {
  children: ReactNode;
  /** An hour's plus passes its time (`HH:mm`) as the plate's starting time. Without it the plate starts at Now. */
  initialTime?: string | undefined;
};
