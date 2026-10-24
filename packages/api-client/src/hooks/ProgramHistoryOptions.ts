import type { DiaryReadOptions } from "./DiaryReadOptions";

/** What the program history hooks take. */
export type ProgramHistoryOptions = DiaryReadOptions & {
  /** How many whole weeks back from today the history reads. */
  weeks: number;
  /**
   * The moment the range ends at, an ISO timestamp with a zone. Today is read from it in the profile's
   * zone. Defaults to the current moment.
   */
  now?: string;
};
