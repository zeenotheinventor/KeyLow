import type { PlateItem, PlateTotals } from "@keylow/core/plate";

/** When the plate is logged: the moment Log foods is pressed, or a clock time (`HH:mm`) on the plate's day. */
export type PlateTime = { isNow: true } | { isNow: false; time: string };

/** Builds the item a screen adds, given the key the plate has minted for its row. */
export type PlateItemBuilder = (key: string) => PlateItem;

export type PlateContextValue = {
  items: readonly PlateItem[];
  /** How many rows are on the plate. */
  count: number;
  totals: PlateTotals;
  /** Whether Log foods can be pressed: online, the profile's zone known, a row, every amount valid, and not logging. */
  canLog: boolean;
  /** Puts an item on the plate (it merges into the same food or recipe in the same unit). */
  add: (build: PlateItemBuilder) => void;
  /** Sets what a row's amount field holds. */
  setQuantity: (key: string, text: string) => void;
  /** Swaps a row for another item in place, keeping its key. It never merges. */
  replace: (key: string, build: PlateItemBuilder) => void;
  remove: (key: string) => void;
  /** Empties the plate, keeping what was on it for `restore`. */
  clear: () => void;
  /** Puts back what `clear` took away. */
  restore: () => void;
  time: PlateTime;
  setTime: (time: PlateTime) => void;
  isLogging: boolean;
  /** Whether the plate has been written to the diary. The sheet is closing, so leaving it asks nothing. */
  isLogged: boolean;
  /** Goes up on every `add`, from any screen, so the search can clear its field when the person comes back from the picker. */
  addCount: number;
};

/** What `useLogPlate` holds the plate with while it logs. Screens do not use it. */
export type PlateLoggingGuard = {
  /**
   * Marks the plate as being logged and says whether the caller may go on. It is false when a log is already
   * running, which is told in the same tick, before any render.
   */
  startLogging: () => boolean;
  /** Marks the log as over. A log that worked is not released: the closing sheet takes the plate with it. */
  finishLogging: () => void;
  /**
   * Marks the plate as logged, so the sheet's guard lets a close through, and runs `afterwards` once the screens
   * have drawn that. The close has to wait for the draw, because a guard that still reads the plate as unlogged
   * would stop it. It runs once.
   */
  markLogged: (afterwards: () => void) => void;
};

/**
 * Whether "Discard your plate?" is on screen, held beside the plate so the sheet's layout can draw the
 * question above every screen of the sheet, whichever screen's Close asked it.
 */
export type PlateExit = {
  isAsking: boolean;
  /** Set when Discard is pressed: the search then lifts its guard and closes the sheet. */
  isDiscarded: boolean;
  /** Puts the question on screen. */
  ask: () => void;
  /** Keep adding: takes the question away and leaves everything as it was. */
  keep: () => void;
  discard: () => void;
};

/** `wasIgnored` is set when nothing was tried: a log was already running, or the plate could not be logged yet. */
export type LogPlateResult = { ok: true } | { ok: false; wasIgnored?: true };
