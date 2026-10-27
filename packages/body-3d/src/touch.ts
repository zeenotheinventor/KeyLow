/**
 * How far a finger may move, in points, between going down and lifting and still be a tap. The body map's 2D
 * figures use this value too, so a tap means the same on both.
 */
export const BODY_TAP_SLOP = 10;

/**
 * How long a finger has to stay down, in milliseconds, for a long press on a muscle. It is the delay the 2D
 * figure's muscles have always had, which React Native's press gives by default, named so the 3D body takes the same.
 */
export const BODY_LONG_PRESS_DELAY_MILLISECONDS = 500;

export type TouchPoint = { x: number; y: number };

export type TouchKind = "tap" | "drag";

/** A touch that lifts more than `slop` points from where it went down is a drag and never a tap. */
export function classifyTouch(down: TouchPoint, up: TouchPoint, slop: number): TouchKind {
  return Math.hypot(up.x - down.x, up.y - down.y) > slop ? "drag" : "tap";
}
