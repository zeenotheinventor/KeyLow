import type { BodyMapLinkScale } from "@keylow/core/training";

/** The query parameter that names the scale the body map opens on. */
export const BODY_MAP_SCALE_PARAMETER = "scale";

/** The body map page. Opened on Volume it says so, and Heat, where the page opens anyway, is left out. */
export const bodyMapPath = (scale: BodyMapLinkScale = "heat"): string =>
  scale === "volume" ? `/body-map?${BODY_MAP_SCALE_PARAMETER}=volume` : "/body-map";

/** The query parameter that carries the day chosen on the map to the muscle list. It is the only thing the address holds. */
export const MUSCLE_LIST_DAY_PARAMETER = "at";

/** The muscle list page. The day on screen (`YYYY-MM-DD`) is carried to it, and none is today. */
export const muscleListPath = (at?: string): string =>
  at === undefined
    ? `${bodyMapPath()}/muscles`
    : `${bodyMapPath()}/muscles?${MUSCLE_LIST_DAY_PARAMETER}=${encodeURIComponent(at)}`;
