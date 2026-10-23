import type { Mesh } from "three";

/** What a glb holds that the renderers draw: its meshes, by the name they have in the file. */
export type BodyModel = {
  meshes: ReadonlyMap<string, Mesh>;
};
