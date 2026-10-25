import { MathUtils, Vector3 } from "three";

import type { Box3 } from "three";

/** The vertical field of view of the camera that looks at the body. */
export const BODY_FIELD_OF_VIEW_DEGREES = 30;

// The box fills this share of the limiting side, so the head and the feet keep a little air.
const SHARE_OF_VIEW_FILLED = 0.92;

/** Where the camera goes: x, y and z in metres. It looks straight down the negative z axis. */
export type CameraPosition = [x: number, y: number, z: number];

// How far in front of the box the camera stands, for the box to show whole in a view of this width over height.
function framingDistance(box: Box3, aspect: number): number {
  const size = box.getSize(new Vector3());
  const halfViewHeightPerMetre = Math.tan(MathUtils.degToRad(BODY_FIELD_OF_VIEW_DEGREES) / 2);
  const distanceForHeight = size.y / SHARE_OF_VIEW_FILLED / 2 / halfViewHeightPerMetre;
  const distanceForWidth = size.x / SHARE_OF_VIEW_FILLED / 2 / (halfViewHeightPerMetre * aspect);
  return Math.max(distanceForHeight, distanceForWidth);
}

/**
 * Where a camera with `BODY_FIELD_OF_VIEW_DEGREES` stands, in front of the body (which faces +z), so the whole
 * box shows head to feet in a view of this width over height. It is centred on the box, and as far back
 * as the taller or the wider side needs. Distances are measured to the front of the box, so the parts
 * behind it only look smaller.
 */
export function frameBody(box: Box3, aspect: number): CameraPosition {
  const centre = box.getCenter(new Vector3());
  return [centre.x, centre.y, box.max.z + framingDistance(box, aspect)];
}

/**
 * How many points of a view `viewHeightPoints` high one metre of the body's front is, at the framing of
 * `frameBody` for `aspect`. A view wider than that aspect shows the same body at the same size.
 */
export function pointsPerMetre(box: Box3, aspect: number, viewHeightPoints: number): number {
  const viewHeightInMetres =
    2 * framingDistance(box, aspect) * Math.tan(MathUtils.degToRad(BODY_FIELD_OF_VIEW_DEGREES) / 2);
  return viewHeightPoints / viewHeightInMetres;
}
