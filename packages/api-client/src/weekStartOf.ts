import { weekOf } from "@keylow/core/diary";

/** The Monday of the week that holds `localDate` (`YYYY-MM-DD`), the `weekStart` of `keys.diary.week`. */
export function weekStartOf(localDate: string): string {
  const [monday = localDate] = weekOf(localDate);
  return monday;
}
