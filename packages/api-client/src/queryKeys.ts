export const keys = {
  profiles: {
    all: ["profiles"] as const,
    detail: (id: string) => ["profiles", id] as const,
    termsAcceptance: ["profiles", "terms-acceptance"] as const,
    targets: ["profiles", "targets"] as const,
    timeZone: ["profiles", "time-zone"] as const,
    /** The weight unit the signed in user's profile shows loads in, `kg` or `lb`. */
    weightUnit: ["profiles", "weight-unit"] as const,
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
    /** What "Refresh ingredients" would change in one recipe. Read afresh each time, never persisted. */
    refresh: (id: string) => ["recipes", "refresh", id] as const,
    search: (q: string, archived = false) => ["recipes", "search", q, archived] as const,
  },
  /**
   * The training reads. Unlike `recipes` and `weighIns`, these are persisted on mobile: the mobile app
   * keeps each family below by its prefix (`setsAll`, `activeRoutine`, `weekSessionsAll`), so heat, the
   * plan and the week open without a connection. The exercise search and the exercise read, at the
   * end of the family, are not persisted and sit under none of these prefixes. A key holds dates and
   * fixed words only, never a set value, a load or a muscle (the exercise search holds the text the
   * person typed, in memory only). What is stored is rows: heat, volume and the comparison are
   * worked out from them at read time, so they are never stale. Every key sits under `["training"]`.
   * `windowStart` and `weekStart` are `YYYY-MM-DD`, and `weekStart` is the Monday.
   *
   * The session reads follow the same rule. `session(id)`, under the `sessionsAll` prefix, and
   * `activeSession` are persisted on mobile, so a session in progress opens without a connection:
   * what is stored is the session row with its sets, and nothing worked out from them. `lastPerformance`
   * is not persisted, since it is only read while logging, which needs a connection. A session or
   * exercise id is the only thing those keys carry besides fixed words.
   *
   * The history list follows it as well: `history(weekStart)` and `historyList`, under the `historyAll`
   * prefix, are persisted on mobile so the list opens without a connection. What is stored is the
   * sessions with their sets, and the summaries run at read time. A key holds a date and fixed words only.
   *
   * The routine reads follow it too. `routines(archived)`, under `routinesAll`, and `routine(id)`, under
   * `routineAll`, are persisted on mobile so the routines open without a connection. A routine key
   * carries a flag or a routine id besides fixed words, never a routine name or an exercise. The
   * routines are written only with a connection: nothing is queued or replayed from storage.
   */
  training: {
    all: ["training"] as const,
    /** The prefix of every `sets` key. */
    setsAll: ["training", "sets"] as const,
    /** The live sets from `windowStart` on, to the end of the day they were read. Keyed by the day, never by a time. */
    sets: (windowStart: string) => ["training", "sets", windowStart] as const,
    /** The active routine with its days, exercises and muscle maps, or null when there is none. */
    activeRoutine: ["training", "active-routine"] as const,
    /** Whether the signed in user has any live session at all: a yes or no, never a session. Persisted on mobile. */
    hasLoggedSession: ["training", "has-logged-session"] as const,
    /** The prefix of every `weekSessions` key. */
    weekSessionsAll: ["training", "week-sessions"] as const,
    /** The live sessions of the week that starts on `weekStart`, each with its live sets. */
    weekSessions: (weekStart: string) => ["training", "week-sessions", weekStart] as const,
    /**
     * The prefix of every `history` key, and of `historyList`. The history list is persisted on mobile,
     * as rows: the summaries are worked out from them at read time, so they are never stale.
     */
    historyAll: ["training", "history"] as const,
    /** The live sessions of the week that starts on `weekStart`, newest first, each with its routine day's name and its live sets. */
    history: (weekStart: string) => ["training", "history", weekStart] as const,
    /** The history list as one infinite read whose pages are weeks, newest week first. */
    historyList: ["training", "history", "list"] as const,
    /** The prefix of every `session` key. */
    sessionsAll: ["training", "sessions"] as const,
    /** One live session of the signed in user with its routine day's name and its live sets, or null. */
    session: (id: string) => ["training", "sessions", id] as const,
    /** The signed in user's newest live session that has not ended, with its sets, or null. */
    activeSession: ["training", "active-session"] as const,
    /** The prefix of every `routines` key. */
    routinesAll: ["training", "routines"] as const,
    /**
     * The signed in user's routines by name, each with its days and their set counts. `archived` false
     * lists the live routines, and true adds the archived ones. Persisted on mobile, as rows.
     */
    routines: (archived: boolean) => ["training", "routines", archived] as const,
    /** The prefix of every `routine` key. */
    routineAll: ["training", "routine"] as const,
    /** One routine of the signed in user with its days and their exercises in order, or null. Persisted on mobile, as rows. */
    routine: (id: string) => ["training", "routine", id] as const,
    /** The prefix of every `lastPerformance` key, of every exercise. */
    lastPerformanceAll: ["training", "last-performance"] as const,
    /**
     * The working sets of one exercise from its latest earlier sessions. `excludeSessionId` is the
     * session being logged, which is left out. It is part of the key so a session started later never
     * shows the list read while an earlier one was open. Without it, the key is the prefix of all of
     * an exercise's reads, to invalidate them together.
     */
    lastPerformance: (exerciseId: string, excludeSessionId?: string) =>
      excludeSessionId === undefined
        ? (["training", "last-performance", exerciseId] as const)
        : (["training", "last-performance", exerciseId, excludeSessionId] as const),
    /**
     * The signed in user's current training goal (the `training_goals` row that has not ended), or null
     * when there is none. Persisted on mobile, as the row: the priorities are read from it at read time
     * and nothing worked out from them is stored. The key is fixed words only, never an answer. The goal
     * is saved only with a connection: nothing is queued or replayed from storage.
     */
    goals: ["training", "goals"] as const,
    /**
     * Every row the signed in user has saved, newest first. Not persisted: a later screen reads it with
     * a connection. Its second element is not `goals`, so the persisted `goals` prefix does not match it.
     */
    goalsHistory: ["training", "goals-history"] as const,
    /**
     * The prefix of every `exerciseSearch` key. Never persisted: searching exercises by text needs a
     * connection, as the diary's food search does, so it sits under none of the persisted prefixes above.
     */
    exerciseSearchAll: ["training", "exercise-search"] as const,
    /** Exercises whose name contains `q`, the signed in user's own first. The text is the person's search, held in memory only. */
    exerciseSearch: (q: string) => ["training", "exercise-search", q] as const,
    /**
     * One live exercise with its full muscle map, or null: global reference data or the user's own.
     * Never persisted: it is only read while logging or editing, which needs a connection. An exercise
     * id is the only thing the key carries besides fixed words.
     */
    exercise: (id: string) => ["training", "exercise", id] as const,
  },
  /**
   * The weigh-in reads. A family of its own, outside `diary`, and not in the list a persisted cache keeps,
   * so no weigh-in is stored on the device by the diary cache. The trend is derived from `list` and has
   * no key. Every key sits under `["weigh-ins"]`, so one invalidation of `keys.weighIns.all` refreshes
   * everything after a write.
   */
  weighIns: {
    all: ["weigh-ins"] as const,
    /** Every live weigh-in of the signed in user, newest first. */
    list: ["weigh-ins", "list"] as const,
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
