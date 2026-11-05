// The helper files only, because the package's index brings in three.js, which the kit must not read at start.
import { nearestSide, yawAfterDrag } from "@keylow/body-3d/rotation";
import {
  BODY_LONG_PRESS_DELAY_MILLISECONDS,
  BODY_TAP_SLOP,
  classifyTouch,
} from "@keylow/body-3d/touch";
import { viewAfterPan, viewAfterPinch, viewAtRest } from "@keylow/body-3d/zoom";

import type { BodyPose } from "./bodyPose";
import type { MusclePicker, Body3DProps } from "./types";
import type { BodySide } from "@keylow/body-3d/rotation";
import type { TouchPoint } from "@keylow/body-3d/touch";
import type { ZoomBounds } from "@keylow/body-3d/zoom";

/** What the gestures read each time they act, as of the latest render, so a new callback never rebuilds them. */
export type BodyGestureInput = Pick<Body3DProps, "onSideChange" | "onTap" | "onLongPressMuscle"> & {
  pose: BodyPose;
  side: BodySide;
  /** The width in pixels of the body, which a drag across is half a turn. */
  bodyWidth: number;
  /** The height of the body and of the touch area, which are the same. */
  height: number;
  /** The width in pixels of the touch area, which the zoom is about the middle of. */
  stageWidth: number;
  /** How long a settle takes: 220 ms, or 0 with reduced motion. */
  motionMilliseconds: number;
  /** Names the muscle at a point of the touch area, or null while the canvas has nothing in the scene. */
  pickMuscleAt: MusclePicker;
  /** Tells the caller the zoom, when it differs from the one last told. */
  reportZoom: (zoom: number) => void;
};

// Wheel events from a trackpad pinch are small and many, so each pixel of delta is a small share of a zoom.
const WHEEL_ZOOM_PER_PIXEL = 0.01;
// A pinch on a trackpad has no end event, so it lets go when the wheel has been still for this long.
const WHEEL_IDLE_MILLISECONDS = 150;

type Phase =
  // A press that has not moved past the slop, and may still be a tap or a hold.
  | "pending"
  | "dragging"
  // A hold fired, so the press is neither a tap nor a drag.
  | "held"
  // Two fingers are down, or were and one is still down. It never turns the body or taps it.
  | "pinching"
  | "idle";

const distanceBetween = (a: TouchPoint, b: TouchPoint) => Math.hypot(b.x - a.x, b.y - a.y);
const midpointOf = (a: TouchPoint, b: TouchPoint): TouchPoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/**
 * Lets go of a zoom gesture: a zoom hardly past the whole body is the whole body, and the caller is told the zoom.
 */
function settleView({ pose, reportZoom }: BodyGestureInput) {
  const atRest = viewAtRest(pose.view);
  if (atRest !== pose.view) {
    pose.setView(atRest);
  }
  reportZoom(atRest.zoom);
}

/**
 * Turns the body with a drag, taps it, names the muscle under a hold and zooms it with two fingers, on `area`, which
 * is the touch area the body sits in the middle of. Every pointer is captured while it is down and let go when it
 * lifts or the browser cancels it, so a cancel leaves nothing behind. Returns the function that takes it all away.
 *
 * Only one pointer turns the body, taps it or holds, and a second one makes the press a pinch for good. A press
 * that moves past the tap slop is a drag, even if it comes back, so a drag is never a tap or a hold.
 */
function listenToPointers(area: HTMLElement, read: () => BodyGestureInput): () => void {
  const pointers = new Map<number, TouchPoint>();
  let phase: Phase = "idle";
  let down: TouchPoint = { x: 0, y: 0 };
  let dragAnchor: TouchPoint = { x: 0, y: 0 };
  let yawAtDragStart = 0;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let hasPinched = false;
  let pinchStart = { distance: 0, zoom: 1 };
  let lastMidpoint: TouchPoint = { x: 0, y: 0 };

  const localPoint = ({ clientX, clientY }: PointerEvent): TouchPoint => {
    const box = area.getBoundingClientRect();
    return { x: clientX - box.left, y: clientY - box.top };
  };
  const clearHold = () => {
    clearTimeout(holdTimer);
    holdTimer = undefined;
  };
  const bounds = (input: BodyGestureInput): ZoomBounds => ({
    body: { width: input.bodyWidth, height: input.height },
  });
  const firstTwo = () => [...pointers.values()].slice(0, 2);

  const settleTurn = () => {
    const input = read();
    const settledSide = nearestSide(input.pose.yaw);
    input.pose.turnTo(settledSide, input.motionMilliseconds);
    if (settledSide !== input.side) {
      input.onSideChange?.(settledSide);
    }
  };
  const settlePinch = () => {
    if (hasPinched) {
      hasPinched = false;
      settleView(read());
    }
  };
  const startPinch = () => {
    const [a, b] = firstTwo();
    if (a === undefined || b === undefined) {
      return;
    }
    hasPinched = true;
    pinchStart = { distance: distanceBetween(a, b), zoom: read().pose.view.zoom };
    lastMidpoint = midpointOf(a, b);
  };
  const pinchBy = () => {
    const [a, b] = firstTwo();
    if (a === undefined || b === undefined || pinchStart.distance === 0) {
      return;
    }
    const input = read();
    const { pose } = input;
    const midpoint = midpointOf(a, b);
    // The zoom is the fingers' span against where it began, because the two fingers' moves arrive one at a time.
    const zoom = (pinchStart.zoom * distanceBetween(a, b)) / pinchStart.distance;
    const focal = { x: midpoint.x - input.stageWidth / 2, y: midpoint.y - input.height / 2 };
    const pinched = viewAfterPinch(pose.view, zoom / pose.view.zoom, focal, bounds(input));
    pose.setView(
      viewAfterPan(
        pinched,
        { x: midpoint.x - lastMidpoint.x, y: midpoint.y - lastMidpoint.y },
        bounds(input),
      ),
    );
    lastMidpoint = midpoint;
  };

  const startHoldTimer = () => {
    if (read().onLongPressMuscle === undefined) {
      return;
    }
    holdTimer = setTimeout(() => {
      holdTimer = undefined;
      const at = pointers.values().next().value;
      if (phase !== "pending" || at === undefined) {
        return;
      }
      // The hold is not a tap whatever is under the pointer.
      phase = "held";
      const input = read();
      const muscle = input.pickMuscleAt(at);
      if (muscle !== null) {
        input.onLongPressMuscle?.(muscle);
      }
    }, BODY_LONG_PRESS_DELAY_MILLISECONDS);
  };

  const onPointerDown = (event: PointerEvent) => {
    // A mouse turns the body with its main button only.
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    pointers.set(event.pointerId, localPoint(event));
    area.setPointerCapture(event.pointerId);
    if (pointers.size === 1) {
      phase = "pending";
      down = localPoint(event);
      startHoldTimer();
    } else if (pointers.size === 2) {
      clearHold();
      if (phase === "dragging") {
        settleTurn();
      }
      phase = "pinching";
      startPinch();
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) {
      return;
    }
    const point = localPoint(event);
    pointers.set(event.pointerId, point);
    const input = read();
    if (phase === "pending" && classifyTouch(down, point, BODY_TAP_SLOP) === "drag") {
      clearHold();
      phase = "dragging";
      dragAnchor = point;
      yawAtDragStart = input.pose.yaw;
    }
    if (phase === "dragging") {
      input.pose.setYaw(yawAfterDrag(yawAtDragStart, point.x - dragAnchor.x, input.bodyWidth));
    } else if (phase === "pinching") {
      pinchBy();
    }
  };

  /** A pointer is gone, lifted or cancelled. A lift that stayed put is a tap, and a cancel is nothing. */
  const onPointerEnd = (event: PointerEvent, isCancel: boolean) => {
    if (!pointers.delete(event.pointerId)) {
      return;
    }
    if (area.hasPointerCapture(event.pointerId)) {
      area.releasePointerCapture(event.pointerId);
    }
    if (phase === "pinching") {
      // One finger lifting ends the pinch, and the one that stays down turns nothing.
      settlePinch();
    } else if (phase === "dragging") {
      settleTurn();
    } else if (phase === "pending") {
      clearHold();
      if (!isCancel) {
        read().onTap?.();
      }
    }
    if (pointers.size === 0) {
      phase = "idle";
    }
  };
  const onPointerUp = (event: PointerEvent) => {
    onPointerEnd(event, false);
  };
  const onPointerCancel = (event: PointerEvent) => {
    onPointerEnd(event, true);
  };

  area.addEventListener("pointerdown", onPointerDown);
  area.addEventListener("pointermove", onPointerMove);
  area.addEventListener("pointerup", onPointerUp);
  area.addEventListener("pointercancel", onPointerCancel);
  area.addEventListener("lostpointercapture", onPointerCancel);
  return () => {
    clearHold();
    area.removeEventListener("pointerdown", onPointerDown);
    area.removeEventListener("pointermove", onPointerMove);
    area.removeEventListener("pointerup", onPointerUp);
    area.removeEventListener("pointercancel", onPointerCancel);
    area.removeEventListener("lostpointercapture", onPointerCancel);
  };
}

/**
 * A trackpad pinch, which a browser sends as the wheel with ctrl held. It zooms about the pointer, and the page does
 * not zoom. A wheel without ctrl is not handled at all, so it scrolls the page. The pinch has no end event, so it lets
 * go when the wheel has been still for a moment. Returns the function that takes it away.
 */
function listenToWheel(area: HTMLElement, read: () => BodyGestureInput): () => void {
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  const onWheel = (event: WheelEvent) => {
    if (!event.ctrlKey) {
      return;
    }
    event.preventDefault();
    const input = read();
    const box = area.getBoundingClientRect();
    const focal = {
      x: event.clientX - box.left - input.stageWidth / 2,
      y: event.clientY - box.top - input.height / 2,
    };
    const scale = Math.exp(-event.deltaY * WHEEL_ZOOM_PER_PIXEL);
    input.pose.setView(
      viewAfterPinch(input.pose.view, scale, focal, {
        body: { width: input.bodyWidth, height: input.height },
      }),
    );
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      settleView(read());
    }, WHEEL_IDLE_MILLISECONDS);
  };

  // Not passive, because a pinch that the page may also zoom must be told to leave it alone.
  area.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    clearTimeout(idleTimer);
    area.removeEventListener("wheel", onWheel);
  };
}

/** Listens on `area` for every way a pointer turns, taps, holds and zooms the body. Returns the function that stops. */
export function listenToBodyGestures(area: HTMLElement, read: () => BodyGestureInput): () => void {
  const stopPointers = listenToPointers(area, read);
  const stopWheel = listenToWheel(area, read);
  return () => {
    stopPointers();
    stopWheel();
  };
}
