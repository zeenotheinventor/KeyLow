/**
 * The address of the Diary tab on a day (`YYYY-MM-DD`). The tabs stay mounted and the diary keeps the day
 * it was left on, so a screen that links to a day says which one, and the diary shows it.
 */
export function diaryHref(day: string): string {
  return `/diary?day=${day}`;
}
