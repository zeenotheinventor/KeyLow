import { paintsOf, writePaints } from "./paints";

import type { BodyMaterials } from "./bodyMaterials";
import type { Look, LookEmphasis } from "./Look";
import type { MuscleId } from "@keylow/body-model/meshNames";

/**
 * Sets each muscle's material to its look under the emphasis, at once. The other muscles, the core, the head, the
 * skin and the eyes take no look. The head's neck colour follows the neck, so a coloured neck has no grey collar.
 */
export function applyLooks(
  materials: BodyMaterials,
  looks: Readonly<Record<MuscleId, Look>>,
  emphasis: LookEmphasis,
): void {
  writePaints(materials, paintsOf(looks, emphasis));
}
