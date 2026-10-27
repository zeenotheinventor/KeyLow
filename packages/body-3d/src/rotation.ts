/** The two sides of the body that it settles on. */
export type BodySide = "front" | "back";

/** The turn about the vertical axis, in radians, at which the body faces each side. The front is where the model starts. */
export const BODY_SIDE_YAW: Readonly<Record<BodySide, number>> = { front: 0, back: Math.PI };

const HALF_TURN = Math.PI;
const FULL_TURN = 2 * Math.PI;
// A release exactly between the sides is a quarter turn off, which floating point cannot hold exactly after a wrap.
const TIE_TOLERANCE = 1e-9;

/** An angle written as the same angle in (-half a turn, half a turn]. */
function wrapped(angle: number): number {
  const inRange = angle - FULL_TURN * Math.round(angle / FULL_TURN);
  return inRange <= -HALF_TURN ? inRange + FULL_TURN : inRange;
}

/**
 * The turn after a horizontal drag of `dx` points on a body `width` points wide: dragging across the width is
 * half a turn, to the right turning it forward. It is not wrapped, so the body follows the finger past a half
 * turn. A width of nothing leaves the turn as it was.
 */
export function yawAfterDrag(yaw: number, dx: number, width: number): number {
  return width > 0 ? yaw + (dx / width) * HALF_TURN : yaw;
}

/** The side a body at this turn is nearer. Exactly between the two, it is the front. */
export function nearestSide(yaw: number): BodySide {
  return Math.abs(wrapped(yaw)) <= HALF_TURN / 2 + TIE_TOLERANCE ? "front" : "back";
}

/**
 * The turn to end on to face `side` from `yaw` by the shorter arc, which is never more than half a turn. It is
 * unwrapped, so an animation from `yaw` to it never spins the long way round. A half turn, which is as short
 * either way, goes forward.
 */
export function yawToReachSide(yaw: number, side: BodySide): number {
  return yaw + wrapped(BODY_SIDE_YAW[side] - yaw);
}

/** What `turnAboutCentre` moves: a group, or anything with a turn about y and a position. */
type Turnable = {
  rotation: { y: number };
  position: { set: (x: number, y: number, z: number) => unknown };
};

/**
 * Turns the body by `yaw` about the vertical line through (`centreX`, `centreZ`), the middle of its box, so it
 * turns on the spot wherever the model has its origin. The group turns about its own origin, so it is moved by
 * what keeps that line where it was: the centre minus the centre turned.
 */
export function turnAboutCentre(group: Turnable, yaw: number, centreX: number, centreZ: number) {
  const sine = Math.sin(yaw);
  const cosine = Math.cos(yaw);
  group.rotation.y = yaw;
  group.position.set(
    centreX - (centreX * cosine + centreZ * sine),
    0,
    centreZ - (centreZ * cosine - centreX * sine),
  );
}
