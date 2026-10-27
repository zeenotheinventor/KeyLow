import { Mesh, Raycaster, Vector2 } from "three";

import { isMuscleId } from "./byMuscle";

import type { TouchPoint } from "./touch";
import type { MuscleId } from "@keylow/body-model/meshNames";
import type { Camera, Group } from "three";

/** The size in points of the view the point is measured in: the whole canvas the body is drawn on. */
export type PickSize = { width: number; height: number };

// The muscle meshes that are drawn as muscle: the 22 ids, and the one mesh of muscle that has none. The skin, the
// core, the head and the eyes are not in the list, so none of them can stand in front of a muscle.
const isDrawnMuscle = (name: string) => isMuscleId(name) || name === "other";

const raycaster = new Raycaster();

/**
 * The muscle drawn at `point`, or null. The point is in points from the top left of a view `size` across, the
 * camera and the group are the ones that draw the body, as they are now, and the ray is cast through the
 * skin to the first muscle mesh it meets. A hit on the mesh of muscle that has no id is null, because that is
 * what is drawn there. Nothing is logged or kept.
 */
export function pickMuscle(
  point: TouchPoint,
  size: PickSize,
  camera: Camera,
  bodyGroup: Group,
): MuscleId | null {
  if (size.width <= 0 || size.height <= 0) {
    return null;
  }
  // The matrices are made when a frame draws, and the camera and the group may have moved since.
  camera.updateMatrixWorld();
  bodyGroup.updateWorldMatrix(true, true);
  const normalised = new Vector2((point.x / size.width) * 2 - 1, 1 - (point.y / size.height) * 2);
  raycaster.setFromCamera(normalised, camera);
  const muscles = bodyGroup.children.filter(
    (child): child is Mesh => child instanceof Mesh && isDrawnMuscle(child.name),
  );
  const [nearest] = raycaster.intersectObjects(muscles, false);
  const name = nearest?.object.name;
  return name !== undefined && isMuscleId(name) ? name : null;
}
