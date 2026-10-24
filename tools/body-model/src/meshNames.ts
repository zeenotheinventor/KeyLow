// The 27 mesh names of dist/male.glb, in file order. The app reads this list to find each mesh by name.
import { MUSCLE_IDS } from "@keylow/core/training";

import { MESHES_WITHOUT_AN_ID } from "./meshesWithoutAnId";

export { MUSCLE_IDS };
export type { MuscleId } from "@keylow/core/training";

/** The 22 muscle ids of `MUSCLE_IDS`, then the meshes that have no id. */
export const BODY_MESH_NAMES = [...MUSCLE_IDS, ...MESHES_WITHOUT_AN_ID];
