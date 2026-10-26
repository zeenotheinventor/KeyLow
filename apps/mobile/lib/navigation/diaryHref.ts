/**
 * The address of the Diary tab on a day (`YYYY-MM-DD`). The tabs stay mounted and the diary keeps the day
 * it was left on, so a screen that links to a day says which one, and the diary shows it. `hour` (0 to 23)
 * also scrolls that hour's group of foods to the top of the day. Without it the address is the day alone.
 */
export function diaryHref(day: string, hour?: number): string {
  return hour === undefined ? `/diary?day=${day}` : `/diary?day=${day}&hour=${hour}`;
}
