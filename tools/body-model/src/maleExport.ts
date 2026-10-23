// What the phone file says about itself, and the step that turns Blender's raw export into dist/male.glb.
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { quantiseGlb } from "./quantiseGlb.ts";

export const ATTRIBUTION_LINES = [
  "BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan",
  "Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0",
];
export const COPYRIGHT = ["CC BY-SA 4.0", ...ATTRIBUTION_LINES].join("\n");
export const GENERATOR = "Ki-Lo body-model zanatomy_export";
export const RAW_GLB_NAME = "male-raw.glb";
const MESHES_AFTER_THE_IDS = ["other", "skin", "core", "head", "eyes"];

/** The 27 mesh names in the order of the contract: the muscle ids, then the meshes that have no id. */
export function meshNames(muscleIds: string[]): string[] {
  return [...muscleIds, ...MESHES_AFTER_THE_IDS];
}

export function finishMaleExport(rawGlb: Buffer, muscleIds: string[]): Buffer {
  return quantiseGlb(rawGlb, {
    generator: GENERATOR,
    copyright: COPYRIGHT,
    nodeOrder: meshNames(muscleIds),
  });
}

/** Deletes the raw file of an earlier run, so a failed Blender run cannot leave an old file to be shipped. */
export function removeStaleRawGlb(workFolder: string): void {
  rmSync(join(workFolder, RAW_GLB_NAME), { force: true });
}

/** The raw file Blender wrote, or a stop when it wrote none. */
export function readRawGlb(workFolder: string): Buffer {
  try {
    return readFileSync(join(workFolder, RAW_GLB_NAME));
  } catch {
    throw new Error(`Blender did not write ${RAW_GLB_NAME} in the work folder.`);
  }
}
