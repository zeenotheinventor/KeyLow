type FoodSearchTarget = {
  /** The day to log to, `YYYY-MM-DD`. The sheet is always in log mode. */
  day: string;
  /** Set from an hour's plus only: 0 to 23. The sheet then logs at that hour, on the hour. */
  hour?: number | undefined;
};

/**
 * The address of the food search sheet in log mode for `day`. `time` (`HH:mm`, always on the hour) is sent
 * only from an hour's plus. The search dock and the tab bar's plus send `day` alone, which means now on that
 * day, whichever tab they are pressed on. The browse sheet, More, Your foods, has its own address.
 */
export function foodSearchHref({ day, hour }: FoodSearchTarget): string {
  const time = hour === undefined ? "" : `&time=${String(hour).padStart(2, "0")}:00`;

  return `/foods?day=${day}${time}`;
}
