/** The screens that open the body map and that it names its Back control for. */
export type BodyMapOrigin = "dashboard" | "train";

/** The body map screen, pushed over the tabs. Opened from the Train home it says so, so Back reads "Back to Train". */
export const bodyMapPath = (origin: BodyMapOrigin = "dashboard"): string =>
  origin === "train" ? "/body-map?from=train" : "/body-map";

/** The origin a `from` parameter names. Anything but the Train home's own value is the dashboard, and a cold link has none. */
export const bodyMapOriginOf = (from: string | undefined): BodyMapOrigin =>
  from === "train" ? "train" : "dashboard";
