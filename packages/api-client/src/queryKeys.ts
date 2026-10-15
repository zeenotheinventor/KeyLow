export const keys = {
  profiles: {
    all: ["profiles"] as const,
    detail: (id: string) => ["profiles", id] as const,
    termsAcceptance: ["profiles", "terms-acceptance"] as const,
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
   * The diary reads. `day` and `week` are the two a persisted cache keeps. Every key sits under
   * `["diary"]`, so one invalidation of `keys.diary.all` refreshes a diary after a write.
   * `localDate` is `YYYY-MM-DD`, `weekStart` is the Monday of the week as `YYYY-MM-DD`, and
   * `month` is `YYYY-MM`.
   */
  diary: {
    all: ["diary"] as const,
    day: (localDate: string) => ["diary", "day", localDate] as const,
    week: (weekStart: string) => ["diary", "week", weekStart] as const,
    completeDays: (month: string) => ["diary", "complete-days", month] as const,
    recentFoods: ["diary", "recent-foods"] as const,
  },
};
