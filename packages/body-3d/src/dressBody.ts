import { BODY_MESH_NAMES } from "@keylow/body-model/meshNames";
import { Box3, Group } from "three";

import { bodyMaterials } from "./bodyMaterials";
import { isMuscleId } from "./byMuscle";

import type { BodyColours, BodyMaterials } from "./bodyMaterials";
import type { BodyModel } from "./types";
import type { Material, Mesh } from "three";

/** A body ready to put in a scene, with everything it owns. */
export type DressedBody = {
  /** One mesh for each name of the contract, in the order of the contract. */
  group: Group;
  /** The materials of the body, which `applyLooks` and the fade set. */
  materials: BodyMaterials;
  /** The box round the group, in metres. */
  box: Box3;
  /** Frees the geometry and the materials of this body. Call it when the canvas that draws it goes. */
  dispose: () => void;
};

// Opaque meshes are all 0, so the skin comes after them whatever order three sorts the transparent ones in.
const SKIN_RENDER_ORDER = 1;

/**
 * Each mesh the file gives is the same for every canvas. The eyes' material is the one the file gives
 * them, copied, and the rest is picked by name. A muscle has a material of its own.
 */
function materialFor(mesh: Mesh, materials: BodyMaterials): Material | Material[] {
  if (isMuscleId(mesh.name)) {
    return materials.muscles[mesh.name];
  }
  switch (mesh.name) {
    case "other":
      return materials.other;
    case "core":
      return materials.core;
    case "head":
      return materials.head;
    case "skin":
      return materials.skin;
    case "eyes":
      return Array.isArray(mesh.material)
        ? mesh.material.map((material) => material.clone())
        : mesh.material.clone();
    default:
      throw new Error(`The body model has a mesh named ${mesh.name}, which the contract does not.`);
  }
}

/**
 * Copies the meshes of a loaded model into a group with the body's materials. The copy has its own
 * geometry and its own materials, because three.js adds a listener to the geometry and the material of
 * every renderer that draws them, and a copy shared between canvases would keep each dead renderer alive.
 * Throws when the model lacks a mesh of the contract.
 */
export function dressBody(model: BodyModel, colours: BodyColours): DressedBody {
  const materials = bodyMaterials(colours);
  const group = new Group();
  const owned = new Set<Material>([
    ...Object.values(materials.muscles),
    materials.other,
    materials.core,
    materials.head,
    materials.skin,
  ]);
  const geometries: Mesh["geometry"][] = [];

  for (const name of BODY_MESH_NAMES) {
    const source = model.meshes.get(name);
    if (source === undefined) {
      throw new Error(`The body model has no mesh named ${name}.`);
    }
    const mesh = source.clone();
    mesh.geometry = source.geometry.clone();
    mesh.material = materialFor(source, materials);
    if (name === "skin") {
      mesh.renderOrder = SKIN_RENDER_ORDER;
    }
    geometries.push(mesh.geometry);
    for (const material of [mesh.material].flat()) {
      owned.add(material);
    }
    group.add(mesh);
  }

  return {
    group,
    materials,
    box: new Box3().setFromObject(group),
    dispose: () => {
      for (const geometry of geometries) {
        geometry.dispose();
      }
      for (const material of owned) {
        material.dispose();
      }
    },
  };
}
