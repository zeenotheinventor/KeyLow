/** How far the row slides to show the action: the action's width, 88 points. */
export const actionWidth = 88;

/** The row follows the finger, but only left of where it rests and no further than the action is wide. */
export function followFinger(restingOffset: number, fingerDistance: number): number {
  return Math.min(0, Math.max(-actionWidth, restingOffset + fingerDistance));
}

/** A flick is a release faster than this, in points per millisecond: 300 points a second. */
export const flickVelocity = 0.3;

/**
 * Where the row comes to rest when let go: a quick flick decides it, left to open and right to close,
 * however short the drag. Otherwise it is open once it is past halfway, and closed if not. The
 * velocity is the finger's, in points per millisecond, negative when moving left.
 */
export function restingOffsetFor(offset: number, velocity = 0): number {
  if (velocity < -flickVelocity) {
    return -actionWidth;
  }
  if (velocity > flickVelocity) {
    return 0;
  }
  return offset < -actionWidth / 2 ? -actionWidth : 0;
}
