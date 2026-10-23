// The asset contract of ADR 0005 Amendment 5, written once. It reads a glb with the parser in glb.ts, so there is no
// dependency, and it returns a list of problems that is empty when the file is good. Messages name the mesh or the
// value at fault and never print vertex data.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { MUSCLE_IDS } from "@keylow/core/training";

import { readGlb, type Gltf, type GltfAccessor, type GltfNode } from "./glb.ts";
import { ATTRIBUTION_LINES, COPYRIGHT } from "./maleExport.ts";
import { BODY_MESH_NAMES } from "./meshNames.ts";

export const MAXIMUM_FILE_BYTES = 4 * 1024 * 1024;
export const MAXIMUM_BODY_TRIANGLES = 250_000;
export const MINIMUM_MUSCLE_ID_TRIANGLES = 1000;
export const MINIMUM_BODY_HEIGHT_METRES = 1.6;
export const MAXIMUM_BODY_HEIGHT_METRES = 2.0;
/** How far the feet may be from y = 0 and the skin from the middle of x and z, in metres. */
export const PLACEMENT_TOLERANCE_METRES = 0.002;
/** How far in front of the middle of the skin the eyes must be, in metres. */
export const MINIMUM_EYES_FORWARD_METRES = 0.03;
export const LICENCE_FILE_NAME = "LICENCE.md";
const ALLOWED_EXTENSION = "KHR_mesh_quantization";
const FORBIDDEN_PARTS = ["cameras", "animations", "skins", "textures", "images"] as const;
const TRIANGLES_MODE = 4;
const STORED_RANGE_BY_COMPONENT_TYPE: Record<number, number> = {
  5120: 127,
  5121: 255,
  5122: 32767,
  5123: 65535,
};

type Bounds = { low: number[]; high: number[] };

const counted = new Intl.NumberFormat("en-GB");

function label(name: string | undefined): string {
  return `\`${name ?? "(unnamed)"}\``;
}

/** The nodes of the scene, in the order the file draws them. */
function sceneNodes(json: Gltf): GltfNode[] {
  const indices = json.scenes?.[json.scene ?? 0]?.nodes ?? [];
  return indices.flatMap((index) => json.nodes[index] ?? []);
}

function meshNodes(json: Gltf): GltfNode[] {
  return sceneNodes(json).filter((node) => node.mesh !== undefined);
}

/** The triangles of one mesh node, over all its primitives. */
function trianglesOfNode(json: Gltf, node: GltfNode): number {
  const mesh = json.meshes[node.mesh ?? -1];
  return (mesh?.primitives ?? []).reduce((sum, primitive) => {
    const counting = json.accessors[primitive.indices ?? primitive.attributes.POSITION ?? -1];
    return sum + (counting?.count ?? 0) / 3;
  }, 0);
}

/** The triangles of every mesh node, by node name, for reports. */
export function trianglesByMeshName(json: Gltf): Record<string, number> {
  return Object.fromEntries(
    meshNodes(json).map((node) => [node.name ?? "", trianglesOfNode(json, node)]),
  );
}

function nameProblems(json: Gltf): string[] {
  const names = meshNodes(json).map((node) => node.name ?? "");
  const problems: string[] = [];
  BODY_MESH_NAMES.forEach((expected) => {
    const times = names.filter((name) => name === expected).length;
    if (times === 0) {
      problems.push(`${label(expected)} is missing`);
    } else if (times === 2) {
      problems.push(`${label(expected)} appears twice`);
    } else if (times > 2) {
      problems.push(`${label(expected)} appears ${times} times`);
    }
  });
  new Set(names.filter((name) => !BODY_MESH_NAMES.includes(name))).forEach((name) => {
    problems.push(`${label(name)} is not a mesh of the contract`);
  });
  const inScene = sceneNodes(json);
  inScene
    .filter((node) => node.mesh === undefined)
    .forEach((node) => {
      problems.push(`the node ${label(node.name)} has no mesh, the contract has mesh nodes only`);
    });
  json.nodes
    .filter((node) => !inScene.includes(node))
    .forEach((node) => {
      problems.push(`the node ${label(node.name)} is not in the scene`);
    });
  if (problems.length === 0 && names.some((name, position) => name !== BODY_MESH_NAMES[position])) {
    problems.push("the meshes are not in the order of the contract");
  }
  return problems;
}

function meshProblems(json: Gltf, node: GltfNode): string[] {
  const name = node.name ?? "";
  const mesh = json.meshes[node.mesh ?? -1];
  if (mesh === undefined) {
    return [`${label(name)} points at a mesh that does not exist`];
  }
  const problems: string[] = [];
  if (mesh.primitives.length !== 1) {
    problems.push(`${label(name)} has ${mesh.primitives.length} primitives, the contract is one`);
  }
  mesh.primitives.forEach((primitive) => {
    if (primitive.attributes.POSITION === undefined) {
      problems.push(`${label(name)} has no positions`);
    }
    if (primitive.attributes.NORMAL === undefined) {
      problems.push(`${label(name)} has no normals`);
    }
    if (primitive.mode !== undefined && primitive.mode !== TRIANGLES_MODE) {
      problems.push(`${label(name)} is not drawn as triangles`);
    }
  });
  const triangles = trianglesOfNode(json, node);
  if (triangles === 0) {
    problems.push(`${label(name)} has no triangles`);
  } else if (
    MUSCLE_IDS.some((muscleId) => muscleId === name) &&
    triangles < MINIMUM_MUSCLE_ID_TRIANGLES
  ) {
    problems.push(
      `${label(name)} has ${counted.format(triangles)} triangles, the floor is ${counted.format(MINIMUM_MUSCLE_ID_TRIANGLES)}`,
    );
  }
  const materialNames = mesh.primitives
    .filter((primitive) => primitive.material !== undefined)
    .map((primitive) => json.materials?.[primitive.material ?? -1]?.name);
  if (materialNames.length === 0) {
    problems.push(`${label(name)} has no material, expected \`mat_${name}\``);
  }
  materialNames.forEach((materialName) => {
    if (materialName !== `mat_${name}`) {
      problems.push(
        `${label(name)} uses the material ${label(materialName)}, expected \`mat_${name}\``,
      );
    }
  });
  return problems;
}

function bodyTriangleProblems(json: Gltf): string[] {
  const total = meshNodes(json).reduce((sum, node) => sum + trianglesOfNode(json, node), 0);
  return total > MAXIMUM_BODY_TRIANGLES
    ? [
        `the body has ${counted.format(total)} triangles, the limit is ${counted.format(MAXIMUM_BODY_TRIANGLES)}`,
      ]
    : [];
}

function contentProblems(json: Gltf): string[] {
  const problems: string[] = [];
  FORBIDDEN_PARTS.forEach((part) => {
    const count = json[part]?.length ?? 0;
    if (count > 0) {
      problems.push(`the file has ${part} (${count}), the contract allows none`);
    }
  });
  new Set([
    ...(json.extensionsUsed ?? []),
    ...(json.extensionsRequired ?? []),
    ...Object.keys(json.extensions ?? {}),
    ...json.nodes.flatMap((node) => Object.keys(node.extensions ?? {})),
  ]).forEach((extension) => {
    if (extension !== ALLOWED_EXTENSION) {
      problems.push(
        `the file uses the extension \`${extension}\`, only ${ALLOWED_EXTENSION} is allowed`,
      );
    }
  });
  return problems;
}

/** The world bounds of a mesh node: its translation plus its scale times the stored positions, in metres. */
function worldBounds(json: Gltf, node: GltfNode): Bounds | undefined {
  const primitive = json.meshes[node.mesh ?? -1]?.primitives[0];
  const accessor: GltfAccessor | undefined = json.accessors[primitive?.attributes.POSITION ?? -1];
  if (accessor?.min === undefined || accessor.max === undefined) {
    return undefined;
  }
  const range =
    (accessor.normalized ? STORED_RANGE_BY_COMPONENT_TYPE[accessor.componentType] : undefined) ?? 1;
  const place = (axis: number, stored: number | undefined) =>
    (node.translation?.[axis] ?? 0) + ((stored ?? 0) / range) * (node.scale?.[axis] ?? 1);
  const ends = [0, 1, 2].map((axis) => [
    place(axis, accessor.min?.[axis]),
    place(axis, accessor.max?.[axis]),
  ]);
  return {
    low: ends.map((pair) => Math.min(...pair)),
    high: ends.map((pair) => Math.max(...pair)),
  };
}

function metres(value: number): string {
  return value.toFixed(3);
}

function placementProblems(json: Gltf): string[] {
  const problems: string[] = [];
  const boundsByName = new Map<string, Bounds>();
  meshNodes(json).forEach((node) => {
    if (node.rotation !== undefined || node.matrix !== undefined) {
      problems.push(
        `${label(node.name)} has a rotation or a matrix, the contract has a translation and a scale only`,
      );
      return;
    }
    const bounds = worldBounds(json, node);
    if (bounds === undefined) {
      problems.push(`${label(node.name)} has no position bounds, so it cannot be placed`);
      return;
    }
    boundsByName.set(node.name ?? "", bounds);
  });
  const all = [...boundsByName.values()];
  if (all.length === 0) {
    return problems;
  }
  const feet = Math.min(...all.map((bounds) => bounds.low[1] ?? 0));
  const top = Math.max(...all.map((bounds) => bounds.high[1] ?? 0));
  if (Math.abs(feet) > PLACEMENT_TOLERANCE_METRES) {
    problems.push(`the feet are at y = ${metres(feet)}, they must be on y = 0`);
  }
  const height = top - feet;
  if (height < MINIMUM_BODY_HEIGHT_METRES || height > MAXIMUM_BODY_HEIGHT_METRES) {
    problems.push(`the body is ${metres(height)} m tall, it must be 1.6 to 2.0 m`);
  }
  const skin = boundsByName.get("skin");
  if (skin !== undefined) {
    (["x", "z"] as const).forEach((axisName, position) => {
      const axis = position === 0 ? 0 : 2;
      const middle = ((skin.low[axis] ?? 0) + (skin.high[axis] ?? 0)) / 2;
      if (Math.abs(middle) > PLACEMENT_TOLERANCE_METRES) {
        problems.push(
          `the skin is centred on ${axisName} = ${metres(middle)}, it must be on ${axisName} = 0`,
        );
      }
    });
  }
  const eyes = boundsByName.get("eyes");
  if (skin !== undefined && eyes !== undefined) {
    const forward =
      ((eyes.low[2] ?? 0) + (eyes.high[2] ?? 0)) / 2 -
      ((skin.low[2] ?? 0) + (skin.high[2] ?? 0)) / 2;
    if (forward < MINIMUM_EYES_FORWARD_METRES) {
      problems.push("the eyes are not in front of the body, the model must face +z");
    }
  }
  return problems;
}

function licenceProblems(json: Gltf, licence: string | undefined): string[] {
  const problems: string[] = [];
  const copyright = json.asset.copyright;
  if (copyright === undefined) {
    problems.push("asset.copyright is missing");
  } else {
    COPYRIGHT.split("\n")
      .filter((line) => !copyright.includes(line))
      .forEach((line) => problems.push(`asset.copyright lacks the line \`${line}\``));
  }
  if (licence === undefined) {
    problems.push(`${LICENCE_FILE_NAME} is missing beside the glb`);
  } else {
    ATTRIBUTION_LINES.filter((line) => !licence.includes(line)).forEach((line) =>
      problems.push(`${LICENCE_FILE_NAME} lacks the line \`${line}\``),
    );
  }
  return problems;
}

/** The problems of a glb against the contract, empty when it is good. `licence` is the text of the LICENCE.md beside it. */
export function verifyGlb(glb: Buffer, licence: string | undefined): string[] {
  let json: Gltf;
  try {
    ({ json } = readGlb(glb));
  } catch (error) {
    return [
      `the file is not a glTF binary: ${error instanceof Error ? error.message : "unreadable"}`,
    ];
  }
  const problems: string[] = [];
  if (glb.length > MAXIMUM_FILE_BYTES) {
    problems.push(
      `the file is ${(glb.length / 1024 / 1024).toFixed(2)} MB, the limit is ${MAXIMUM_FILE_BYTES / 1024 / 1024} MB`,
    );
  }
  return [
    ...problems,
    ...contentProblems(json),
    ...nameProblems(json),
    ...meshNodes(json).flatMap((node) => meshProblems(json, node)),
    ...bodyTriangleProblems(json),
    ...placementProblems(json),
    ...licenceProblems(json, licence),
  ];
}

/** `verifyGlb` for a file on disk, with the LICENCE.md in the same folder. */
export function verifyGlbFile(path: string): string[] {
  let glb: Buffer;
  try {
    glb = readFileSync(path);
  } catch {
    return [`the file ${path} cannot be read`];
  }
  let licence: string | undefined;
  try {
    licence = readFileSync(join(dirname(path), LICENCE_FILE_NAME), "utf8");
  } catch {
    licence = undefined;
  }
  return verifyGlb(glb, licence);
}
