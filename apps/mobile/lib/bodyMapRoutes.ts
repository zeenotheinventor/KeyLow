/** The screens that open the body map and that it names its Back control for. */
export type BodyMapOrigin = "dashboard" | "train";

/** The body map screen, pushed over the tabs. Opened from the Train home it says so, so Back reads "Back to Train". */
export const bodyMapPath = (origin: BodyMapOrigin = "dashboard"): string =>
  origin === "train" ? "/body-map?from=train" : "/body-map";

/** The origin a `from` parameter names. Anything but the Train home's own value is the dashboard, and a cold link has none. */
export const bodyMapOriginOf = (from: string | undefined): BodyMapOrigin =>
  from === "train" ? "train" : "dashboard";

/** The query parameter that carries the day chosen on the map to the muscle list. It is the only thing the address holds. */
const MUSCLE_LIST_DAY_PARAMETER = "at";

/** The muscle list, pushed over the body map. The day chosen on the map (`YYYY-MM-DD`) is carried to it, and none is today. */
export const muscleListPath = (at?: string): string =>
  at === undefined
    ? "/body-map/muscles"
    : `/body-map/muscles?${MUSCLE_LIST_DAY_PARAMETER}=${encodeURIComponent(at)}`;
