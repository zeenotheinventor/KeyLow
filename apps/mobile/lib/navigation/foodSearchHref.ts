type FoodSearchTarget = {
  /** The day the diary shows, `YYYY-MM-DD`. Without it the sheet is not in log mode. */
  day?: string | null | undefined;
  /** Set from an hour's plus only: 0 to 23. The sheet then logs at that hour, on the hour. */
  hour?: number | undefined;
};

/**
 * The address of the food search sheet. `day` puts it in log mode for that day, and `time` (`HH:mm`, always
 * on the hour) is sent only from an hour's plus. The search dock and the tab bar's plus send `day` alone,
 * which means now on that day. With neither it is the plain sheet.
 */
export function foodSearchHref({ day, hour }: FoodSearchTarget = {}): string {
  if (day === undefined || day === null) {
    return "/foods";
  }
  const time = hour === undefined ? "" : `&time=${String(hour).padStart(2, "0")}:00`;

  return `/foods?day=${day}${time}`;
}
