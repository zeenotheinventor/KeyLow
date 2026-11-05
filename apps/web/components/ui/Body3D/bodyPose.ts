// The helper files only, because the package's index brings in three.js, which this module must not read at start.
import { BODY_SIDE_YAW, yawToReachSide } from "@keylow/body-3d/rotation";
import { WHOLE_BODY_VIEW } from "@keylow/body-3d/zoom";

import type { BodySide } from "@keylow/body-3d/rotation";
import type { ZoomView } from "@keylow/body-3d/zoom";

/** An ease in and out, so a turn and a reset start and stop softly. It is 0.5 half way through. */
const smooth = (progress: number) => progress * progress * (3 - 2 * progress);

type Ease<Value> = { from: Value; to: Value; elapsedMilliseconds: number; milliseconds: number };

/**
 * Where the body faces and how it is zoomed and moved on the stage, which the pointer writes and the canvas draws. It
 * is plain data, so neither side re-renders React for a frame of a drag, and it holds no three.js, so the outer
 * file can own it while the canvas loads later. A write ends any ease of the same thing, so a finger that lands on a
 * body that is still settling carries on from where it is.
 */
export type BodyPose = {
  /** The turn about the vertical axis in radians, 0 facing the front. Not wrapped. */
  readonly yaw: number;
  readonly view: ZoomView;
  /** The view an ease in progress is heading to, or the view itself when none is. */
  readonly viewTarget: ZoomView;
  /** Follows a finger: sets the turn at once. */
  setYaw: (yaw: number) => void;
  /** Turns to face `side` by the shorter arc over `milliseconds`, or at once with 0. */
  turnTo: (side: BodySide, milliseconds: number) => void;
  /** Sets the view at once, as a pinch, a pan and a wheel do. */
  setView: (view: ZoomView) => void;
  /** Eases to `view` over `milliseconds`, or at once with 0. */
  easeViewTo: (view: ZoomView, milliseconds: number) => void;
  /** Moves any ease on by `deltaMilliseconds`. True while one is still under way, so the next frame is wanted. */
  step: (deltaMilliseconds: number) => boolean;
  /** Calls `listener` after every write, and returns the function that stops it. */
  subscribe: (listener: () => void) => () => void;
};

export function createBodyPose(side: BodySide): BodyPose {
  let yaw = BODY_SIDE_YAW[side];
  let view: ZoomView = WHOLE_BODY_VIEW;
  let turn: Ease<number> | null = null;
  let viewEase: Ease<ZoomView> | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    listeners.forEach((listener) => {
      listener();
    });
  };

  return {
    get yaw() {
      return yaw;
    },
    get view() {
      return view;
    },
    get viewTarget() {
      return viewEase === null ? view : viewEase.to;
    },
    setYaw(next) {
      yaw = next;
      turn = null;
      notify();
    },
    turnTo(target, milliseconds) {
      const to = yawToReachSide(yaw, target);
      if (to === yaw) {
        return;
      }
      if (milliseconds === 0) {
        yaw = to;
        turn = null;
      } else {
        turn = { from: yaw, to, elapsedMilliseconds: 0, milliseconds };
      }
      notify();
    },
    setView(next) {
      view = next;
      viewEase = null;
      notify();
    },
    easeViewTo(target, milliseconds) {
      if (milliseconds === 0) {
        view = target;
        viewEase = null;
      } else {
        viewEase = { from: view, to: target, elapsedMilliseconds: 0, milliseconds };
      }
      notify();
    },
    step(deltaMilliseconds) {
      if (turn !== null) {
        turn.elapsedMilliseconds += deltaMilliseconds;
        const progress = Math.min(1, turn.elapsedMilliseconds / turn.milliseconds);
        yaw = turn.from + (turn.to - turn.from) * smooth(progress);
        turn = progress === 1 ? null : turn;
      }
      if (viewEase !== null) {
        viewEase.elapsedMilliseconds += deltaMilliseconds;
        const progress = Math.min(1, viewEase.elapsedMilliseconds / viewEase.milliseconds);
        const { from, to } = viewEase;
        const eased = smooth(progress);
        view =
          progress === 1
            ? to
            : {
                zoom: from.zoom + (to.zoom - from.zoom) * eased,
                x: from.x + (to.x - from.x) * eased,
                y: from.y + (to.y - from.y) * eased,
              };
        viewEase = progress === 1 ? null : viewEase;
      }
      return turn !== null || viewEase !== null;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
