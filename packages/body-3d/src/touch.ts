/**
 * How far a finger may move, in points, between going down and lifting and still be a tap. The body map's 2D
 * figures use this value too, so a tap means the same on both.
 */
export const BODY_TAP_SLOP = 10;

export type TouchPoint = { x: number; y: number };

export type TouchKind = "tap" | "drag";

/** A touch that lifts more than `slop` points from where it went down is a drag and never a tap. */
export function classifyTouch(down: TouchPoint, up: TouchPoint, slop: number): TouchKind {
  return Math.hypot(up.x - down.x, up.y - down.y) > slop ? "drag" : "tap";
}
