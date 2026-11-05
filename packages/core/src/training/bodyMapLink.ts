/** The scales a link can open the body map on. Heat is where it opens when the address says nothing. */
export type BodyMapLinkScale = "heat" | "volume";

/**
 * The scale a `scale` parameter of the body map's address names. Volume for "volume", and Heat for anything
 * else, a cold link with none and a parameter given twice included. The same on every platform.
 */
export const bodyMapScaleOf = (scale: unknown): BodyMapLinkScale =>
  scale === "volume" ? "volume" : "heat";
