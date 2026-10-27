export { BODY_FIELD_OF_VIEW_DEGREES, frameBody, pointsPerMetre } from "./frameBody";
export type { CameraPosition } from "./frameBody";
export { bodyMaterials, colourFixedMaterials } from "./bodyMaterials";
export type { BodyColours, BodyMaterials } from "./bodyMaterials";
export { BODY_LIGHTING } from "./bodyLighting";
export type { BodyLighting, BodyLightingScheme } from "./bodyLighting";
export { dressBody } from "./dressBody";
export type { DressedBody } from "./dressBody";
export { loadBodyModel } from "./loadBodyModel";
export type { BodyModel } from "./types";
export { applyLooks } from "./applyLooks";
export { createLookFade } from "./lookFade";
export type { LookFade } from "./lookFade";
export type { Look, LookEmphasis } from "./Look";
export {
  BODY_SIDE_YAW,
  nearestSide,
  turnAboutCentre,
  yawAfterDrag,
  yawToReachSide,
} from "./rotation";
export { pickMuscle } from "./pickMuscle";
export type { PickSize } from "./pickMuscle";
export type { BodySide } from "./rotation";
export { BODY_LONG_PRESS_DELAY_MILLISECONDS, BODY_TAP_SLOP, classifyTouch } from "./touch";
export type { TouchKind, TouchPoint } from "./touch";
