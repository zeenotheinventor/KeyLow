export type DiaryView = "day" | "week";

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The day in the `date` search parameter when it is one real calendar day (`YYYY-MM-DD`), otherwise undefined. */
export function parseDiaryDate(value: string | string[] | undefined): string | undefined {
  const match = typeof value === "string" ? CALENDAR_DAY.exec(value) : null;
  if (value === undefined || typeof value !== "string" || match === null) {
    return undefined;
  }

  const [, year, month, day] = match;
  const instant = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return instant.toISOString().slice(0, 10) === value ? value : undefined;
}

/** The `view` search parameter: the week view for "week", the day view for anything else. */
export function parseDiaryView(value: string | string[] | undefined): DiaryView {
  return value === "week" ? "week" : "day";
}

/** The diary's address for a day and a view. Today and the day view are left out, so they are the bare `/diary`. */
export function diaryHref({
  date,
  view = "day",
}: {
  date?: string | undefined;
  view?: DiaryView | undefined;
}): string {
  const parameters = new URLSearchParams();
  if (date !== undefined) {
    parameters.set("date", date);
  }
  if (view === "week") {
    parameters.set("view", "week");
  }
  const query = parameters.toString();

  return query === "" ? "/diary" : `/diary?${query}`;
}
