import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { BODY_MESH_NAMES } from "@keylow/body-model/meshNames";
import { Box3, Mesh } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";

import type { Object3D } from "three";

// The class check narrows to a mesh with any geometry and material, which this states in the type once.
const isMesh = (object: Object3D): object is Mesh => object instanceof Mesh;

// Resolved through the package's `exports`, as the app does.
const bytes = readFileSync(fileURLToPath(import.meta.resolve("@keylow/body-model/male.glb")));

async function meshesInFile() {
  const { scene } = await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, "");
  const meshes: Mesh[] = [];
  scene.traverse((object) => {
    if (isMesh(object)) {
      meshes.push(object);
    }
  });
  return meshes;
}

describe("the committed male.glb, read through @keylow/body-model", () => {
  it("should hold each mesh of the contract once and nothing else", async () => {
    const names = (await meshesInFile()).map((mesh) => mesh.name);

    expect([...names].sort()).toEqual([...BODY_MESH_NAMES].sort());
  });

  it("should stand with its feet on 0, between 1.6 and 2.0 metres tall", async () => {
    const box = new Box3();
    for (const mesh of await meshesInFile()) {
      box.union(new Box3().setFromObject(mesh));
    }

    expect(box.min.y).toBeCloseTo(0, 2);
    expect(box.max.y).toBeGreaterThan(1.6);
    expect(box.max.y).toBeLessThan(2);
  });

  it("should be 27 draw calls and fewer triangles than the phone budget", async () => {
    const meshes = await meshesInFile();
    const triangles = meshes.reduce(
      (total, mesh) => total + (mesh.geometry.index?.count ?? 0) / 3,
      0,
    );

    expect(meshes).toHaveLength(27);
    expect(triangles).toBeLessThan(250_000);
  });
});
