import { readFileSync } from "node:fs";

import { BODY_MESH_NAMES, MUSCLE_IDS } from "@keylow/body-model/meshNames";
import { Box3, Color, Mesh, MeshStandardMaterial } from "three";
import { describe, expect, it, vi } from "vitest";

import { dressBody } from "../src/dressBody";
import { loadBodyModel } from "../src/loadBodyModel";
import { loadMaleBody } from "./support/maleGlb";

import type { BodyColours } from "../src/bodyMaterials";
import type { Group, Material } from "three";

const colours: BodyColours = {
  muscle: "tomato",
  otherMuscle: "gold",
  core: "navy",
  clay: "peru",
  skin: "skyblue",
};

function materialOf(mesh: Mesh): Material {
  if (Array.isArray(mesh.material)) {
    throw new Error(`${mesh.name} has more than one material`);
  }
  return mesh.material;
}

const hexOf = (mesh: Mesh) => {
  const material = materialOf(mesh);
  return material instanceof MeshStandardMaterial ? material.color.getHexString() : "";
};
const hexOfName = (name: string) => new Color(name).getHexString();

// The class check narrows to a mesh with any geometry and material, which this states in the type once.
const isMesh = (object: unknown): object is Mesh => object instanceof Mesh;

function meshNamed(group: Group, name: string): Mesh {
  const found = group.getObjectByName(name);
  if (!isMesh(found)) {
    throw new Error(`No mesh named ${name}`);
  }
  return found;
}

// A listener on a geometry or a material, which three's renderer adds the first time it draws one.
const countDisposals = (target: Mesh["geometry"] | Material) => {
  const listener = vi.fn();
  target.addEventListener("dispose", listener);
  return listener;
};

describe("dressBody with the committed male body", () => {
  it("should hold every mesh of the contract once, in the order of the contract", async () => {
    const { group } = dressBody(await loadMaleBody(), colours);

    expect(group.children.map((child) => child.name)).toEqual([...BODY_MESH_NAMES]);
  });

  it("should stand with its feet on 0 and be between 1.6 and 2.0 metres tall", async () => {
    const { box } = dressBody(await loadMaleBody(), colours);

    expect(box.min.y).toBeCloseTo(0, 2);
    expect(box.max.y).toBeGreaterThan(1.6);
    expect(box.max.y).toBeLessThan(2);
  });

  it("should measure the box of the meshes it holds", async () => {
    const { group, box } = dressBody(await loadMaleBody(), colours);

    expect(box).toEqual(new Box3().setFromObject(group));
  });

  it("should colour the 22 muscles, the other muscles, the core and the head from the colours", async () => {
    const { group } = dressBody(await loadMaleBody(), colours);

    expect(hexOf(meshNamed(group, "abs"))).toBe(hexOfName(colours.muscle));
    expect(hexOf(meshNamed(group, "neck"))).toBe(hexOfName(colours.muscle));
    expect(hexOf(meshNamed(group, "other"))).toBe(hexOfName(colours.otherMuscle));
    expect(hexOf(meshNamed(group, "core"))).toBe(hexOfName(colours.core));
    expect(hexOf(meshNamed(group, "head"))).toBe(hexOfName(colours.clay));
  });

  it("should give each muscle a material of its own, so each can take a colour", async () => {
    const { group, materials } = dressBody(await loadMaleBody(), colours);

    expect(meshNamed(group, "abs").material).toBe(materials.muscles.abs);
    expect(meshNamed(group, "abs").material).not.toBe(meshNamed(group, "quads").material);
    expect(new Set(MUSCLE_IDS.map((id) => materials.muscles[id])).size).toBe(22);
  });

  it("should leave the eyes as the file gives them, with their own colours per vertex", async () => {
    const { group } = dressBody(await loadMaleBody(), colours);
    const eyes = meshNamed(group, "eyes");

    expect(eyes.material).toMatchObject({ vertexColors: true });
    expect(eyes.geometry.getAttribute("color")).toBeDefined();
  });

  it("should draw the skin last, and make it the only transparent mesh", async () => {
    const { group } = dressBody(await loadMaleBody(), colours);
    const meshes = group.children.filter(isMesh);
    const skin = meshNamed(group, "skin");

    expect(meshes.filter((mesh) => materialOf(mesh).transparent)).toEqual([skin]);
    expect(Math.max(...meshes.map((mesh) => mesh.renderOrder))).toBe(skin.renderOrder);
    expect(meshes.filter((mesh) => mesh.renderOrder === skin.renderOrder)).toEqual([skin]);
  });

  it("should draw each mesh once, which is 27 draw calls", async () => {
    const { group } = dressBody(await loadMaleBody(), colours);

    expect(group.children).toHaveLength(27);
  });

  it("should not change the model it was given, so a second canvas can dress it again", async () => {
    const model = await loadMaleBody();
    const original = model.meshes.get("abs");
    const originalMaterial = original?.material;

    const { group } = dressBody(model, colours);

    expect(meshNamed(group, "abs")).not.toBe(original);
    expect(original?.material).toBe(originalMaterial);
    expect(original?.parent).not.toBe(group);
  });
});

describe("dressBody dispose", () => {
  it("should dispose its own copies of the geometry and the materials, and nothing of the model", async () => {
    const model = await loadMaleBody();
    const sharedGeometry = model.meshes.get("abs")?.geometry;
    const sharedGeometryListener = sharedGeometry ? countDisposals(sharedGeometry) : vi.fn();
    const dressed = dressBody(model, colours);
    const absListener = countDisposals(meshNamed(dressed.group, "abs").geometry);
    const skinListener = countDisposals(materialOf(meshNamed(dressed.group, "skin")));
    const quadsListener = countDisposals(materialOf(meshNamed(dressed.group, "quads")));
    const eyesListener = countDisposals(materialOf(meshNamed(dressed.group, "eyes")));

    dressed.dispose();

    expect(absListener).toHaveBeenCalledTimes(1);
    expect(skinListener).toHaveBeenCalledTimes(1);
    expect(quadsListener).toHaveBeenCalledTimes(1);
    expect(eyesListener).toHaveBeenCalledTimes(1);
    expect(sharedGeometryListener).not.toHaveBeenCalled();
  });

  it("should give each canvas its own geometry, so no renderer is left listening on a shared one", async () => {
    const model = await loadMaleBody();

    const first = dressBody(model, colours);
    const second = dressBody(model, colours);

    expect(meshNamed(first.group, "abs").geometry).not.toBe(
      meshNamed(second.group, "abs").geometry,
    );
    expect(meshNamed(first.group, "abs").geometry).not.toBe(model.meshes.get("abs")?.geometry);
    expect(meshNamed(first.group, "eyes").material).not.toBe(
      meshNamed(second.group, "eyes").material,
    );
  });
});

describe("dressBody with a file that breaks the contract", () => {
  it("should throw and name the first mesh the file lacks", async () => {
    const cube = readFileSync(new URL("./fixtures/quantised-cube.glb", import.meta.url));
    const model = await loadBodyModel(new Uint8Array(cube).buffer);

    expect(() => dressBody(model, colours)).toThrow("chest_upper");
  });
});
