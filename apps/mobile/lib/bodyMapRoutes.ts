/** The screens that open the body map and that it names its Back control for. */
export type BodyMapOrigin = "dashboard" | "train";

/** The scales a link can open the body map on. Heat is where it opens when the address says nothing. */
export type BodyMapLinkScale = "heat" | "volume";

/**
 * The body map screen, pushed over the tabs. Opened from the Train home it says so, so Back reads "Back to
 * Train". Opened on Volume it says so too, and Heat, where the screen opens anyway, is left out.
 */
export const bodyMapPath = (
  origin: BodyMapOrigin = "dashboard",
  scale: BodyMapLinkScale = "heat",
): string => {
  const parameters = [
    ...(origin === "train" ? ["from=train"] : []),
    ...(scale === "volume" ? ["scale=volume"] : []),
  ];
  return parameters.length === 0 ? "/body-map" : `/body-map?${parameters.join("&")}`;
};

/** The scale a `scale` parameter names. Anything but Volume, and a cold link with none, is Heat. */
export const bodyMapScaleOf = (scale: string | undefined): BodyMapLinkScale =>
  scale === "volume" ? "volume" : "heat";

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
