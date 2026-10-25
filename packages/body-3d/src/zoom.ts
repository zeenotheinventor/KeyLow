/**
 * How the 3D body is zoomed and panned, in points on the stage. A point of the body at `p`, measured from the
 * middle of the stage with the whole body in view, is drawn at `zoom * p + offset`. Nothing here depends on
 * three.js, so the app's kit can read it without loading the renderer.
 */

export type ZoomLimits = { min: number; max: number };

/** From the whole body, as it is framed, to twice as close. */
export const ZOOM_LIMITS: ZoomLimits = { min: 1, max: 2 };

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };

/** The zoom, and how far the zoomed body is moved on the stage: to the right is positive x, down is positive y. */
export type ZoomView = { zoom: number; x: number; y: number };

/** The body filling the view as it is framed, in the middle of the stage. */
export const WHOLE_BODY_VIEW: ZoomView = { zoom: 1, x: 0, y: 0 };

/** The body's area on the stage at the whole body, in points. */
export type ZoomBounds = { body: Size };

// A zoom closer to the whole body than this is taken for it.
const WHOLE_BODY_TOLERANCE = 0.05;

// Adding 0 turns a negative zero, which a limit of nothing gives, into zero.
const clamped = (value: number, limit: number): number =>
  Math.min(limit, Math.max(-limit, value)) + 0;

/** The zoom after a pinch of `scale` (above 1 is closer), kept between the limits. */
export function zoomAfterPinch(zoom: number, scale: number, limits: ZoomLimits = ZOOM_LIMITS) {
  return Math.min(limits.max, Math.max(limits.min, zoom * scale));
}

/**
 * How far the view may be moved either way along each axis at this zoom: the extra half of the body that the zoom
 * adds on each side, so the zoomed body can be moved head to feet and side to side but never off the stage, and
 * the range grows smoothly from nothing at the whole body, where the body stays in the middle.
 */
export function panLimit(zoom: number, { body }: ZoomBounds): Point {
  return {
    x: ((zoom - ZOOM_LIMITS.min) * body.width) / 2,
    y: ((zoom - ZOOM_LIMITS.min) * body.height) / 2,
  };
}

function withinLimit(view: ZoomView, bounds: ZoomBounds): ZoomView {
  const limit = panLimit(view.zoom, bounds);
  return { zoom: view.zoom, x: clamped(view.x, limit.x), y: clamped(view.y, limit.y) };
}

/**
 * The view after a pinch of `scale` with the fingers' middle at `focal`, measured from the middle of the stage.
 * The point of the body under the fingers stays under them, so a pinch over the legs zooms the legs, as far as
 * the head and feet allow. A pinch at a zoom limit that does not change the zoom does not move the body.
 */
export function viewAfterPinch(
  view: ZoomView,
  scale: number,
  focal: Point,
  bounds: ZoomBounds,
  limits: ZoomLimits = ZOOM_LIMITS,
): ZoomView {
  const zoom = zoomAfterPinch(view.zoom, scale, limits);
  if (zoom === view.zoom) {
    return view;
  }
  const ratio = zoom / view.zoom;
  return withinLimit(
    { zoom, x: focal.x - ratio * (focal.x - view.x), y: focal.y - ratio * (focal.y - view.y) },
    bounds,
  );
}

/** The view after two fingers move by `change` points together, kept within the pan limit. */
export function viewAfterPan(view: ZoomView, change: Point, bounds: ZoomBounds): ZoomView {
  return withinLimit({ ...view, x: view.x + change.x, y: view.y + change.y }, bounds);
}

/** The view a gesture settles on: a zoom hardly past the whole body is the whole body, in the middle. */
export function viewAtRest(view: ZoomView): ZoomView {
  return view.zoom - ZOOM_LIMITS.min < WHOLE_BODY_TOLERANCE ? WHOLE_BODY_VIEW : view;
}

/**
 * How far to move the camera, in metres across and up, for the view to show the body moved as it is on the
 * stage. `pointsPerMetre` is the scale of the whole body at the framing. The camera zooms about the middle of
 * its view, so the body moves by the offset when the camera moves the other way by the offset over the zoom.
 */
export function cameraShift(view: ZoomView, pointsPerMetre: number): Point {
  const zoomedPointsPerMetre = view.zoom * pointsPerMetre;
  return {
    x: view.x === 0 ? 0 : -view.x / zoomedPointsPerMetre,
    y: view.y === 0 ? 0 : view.y / zoomedPointsPerMetre,
  };
}
