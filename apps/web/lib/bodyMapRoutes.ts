/** The body map page. */
export const bodyMapPath = (): string => "/body-map";

/** The query parameter that carries the day chosen on the map to the muscle list. It is the only thing the address holds. */
export const MUSCLE_LIST_DAY_PARAMETER = "at";

/** The muscle list page. The day on screen (`YYYY-MM-DD`) is carried to it, and none is today. */
export const muscleListPath = (at?: string): string =>
  at === undefined
    ? `${bodyMapPath()}/muscles`
    : `${bodyMapPath()}/muscles?${MUSCLE_LIST_DAY_PARAMETER}=${encodeURIComponent(at)}`;
