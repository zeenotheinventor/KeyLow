import type { PlateDayBarsState } from "@/lib/plate";

export type PlateStripProps = {
  /** What the day's bars read. The dialog leaves the strip out when this is unavailable, so it is never empty. */
  dayBars: Exclude<PlateDayBarsState, { status: "unavailable" }>;
};
