export const keys = {
  profiles: {
    all: ["profiles"] as const,
    detail: (id: string) => ["profiles", id] as const,
    termsAcceptance: ["profiles", "terms-acceptance"] as const,
    targets: ["profiles", "targets"] as const,
    timeZone: ["profiles", "time-zone"] as const,
  },
  foods: {
    all: ["foods"] as const,
    detail: (id: string) => ["foods", id] as const,
    portions: (id: string) => ["foods", id, "portions"] as const,
    search: (q: string) => ["foods", "search", q] as const,
    offSearch: (q: string) => ["foods", "off-search", q] as const,
    barcode: (code: string) => ["foods", "barcode", code] as const,
    own: ["foods", "own"] as const,
  },
  /**
   * The recipe reads. A family of its own, outside `diary` and the lists a persisted cache keeps, so
   * nothing about a recipe is stored on the device by the diary cache. Every key sits under
   * `["recipes"]`, so one invalidation of `keys.recipes.all` refreshes the library, a recipe and a search.
   * `archived` says whether archived recipes are included besides the live ones.
   */
  recipes: {
    all: ["recipes"] as const,
    list: (archived: boolean) => ["recipes", "list", archived] as const,
    detail: (id: string) => ["recipes", "detail", id] as const,
    search: (q: string, archived = false) => ["recipes", "search", q, archived] as const,
  },
  /**
   * The diary reads. `day` and `week` are the two a persisted cache keeps. Every key sits under
   * `["diary"]`, so one invalidation of `keys.diary.all` refreshes a diary after a write.
   * `localDate` is `YYYY-MM-DD`, `weekStart` is the Monday of the week as `YYYY-MM-DD`, and
   * `month` is `YYYY-MM`.
   */
  diary: {
    all: ["diary"] as const,
    /** The prefix of every `day` key, to invalidate or update all the cached days. */
    days: ["diary", "day"] as const,
    /** The prefix of every `week` key. */
    weeks: ["diary", "week"] as const,
    /** The prefix of every `entry` key. */
    entries: ["diary", "entry"] as const,
    /** The prefix of every `completeDays` key. */
    completeDaysAll: ["diary", "complete-days"] as const,
    day: (localDate: string) => ["diary", "day", localDate] as const,
    /** One entry by its id, for the screen that edits it. */
    entry: (id: string) => ["diary", "entry", id] as const,
    week: (weekStart: string) => ["diary", "week", weekStart] as const,
    completeDays: (month: string) => ["diary", "complete-days", month] as const,
    recentFoods: ["diary", "recent-foods"] as const,
  },
};
