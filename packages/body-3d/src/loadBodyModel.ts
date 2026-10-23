import { Mesh } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { BodyModel } from "./types";
import type { Object3D } from "three";

// The class check narrows to a mesh with any geometry and material, which this states in the type once.
const isMesh = (object: Object3D): object is Mesh => object instanceof Mesh;

/**
 * Parses the bytes of a glb and returns its meshes by name. It decodes `KHR_mesh_quantization` and
 * nothing that needs WebAssembly (no Draco, no meshopt), so the same call runs on Hermes and in a
 * browser. The bytes come from the caller, so this reads no file and makes no request.
 */
export async function loadBodyModel(glb: ArrayBuffer): Promise<BodyModel> {
  const { scene } = await new GLTFLoader().parseAsync(glb, "");
  const meshes = new Map<string, Mesh>();
  scene.traverse((object) => {
    if (isMesh(object)) {
      meshes.set(object.name, object);
    }
  });
  return { meshes };
}
