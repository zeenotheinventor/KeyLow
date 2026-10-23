import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { item, readGlb } from "../src/glb.ts";
import { BODY_MESH_NAMES } from "../src/meshNames.ts";
import { trianglesByMeshName } from "../src/verifyGlb.ts";

const distFolder = join(import.meta.dirname, "../dist");
const glbPath = join(distFolder, "male.glb");
const { json, binary } = readGlb(readFileSync(glbPath));
const EXPECTED_NAMES = BODY_MESH_NAMES;
const POSITION_RANGE = 32767;
const UNSIGNED_INT = 5125;

function sceneNodes() {
  return (json.scenes?.[0]?.nodes ?? []).map((index) => item(json.nodes, index));
}

const trianglesByName = () => trianglesByMeshName(json);

type DecodedMesh = {
  /** Positions as stored, one row of x, y, z per vertex. */
  stored: number[][];
  /** Positions in metres. */
  metres: number[][];
  /** Normals as unit-range numbers. */
  normals: number[][];
  triangles: number[][];
};

function dataOf(accessorIndex: number) {
  const accessor = item(json.accessors, accessorIndex);
  const view = item(json.bufferViews, accessor.bufferView ?? -1);
  return { accessor, offset: view.byteOffset ?? 0, stride: view.byteStride ?? 0 };
}

/** Reads the integers the file stores for one mesh and decodes them the way a glTF loader does. */
function decodeMesh(nodeName: string): DecodedMesh {
  const node = item(
    sceneNodes().filter((candidate) => candidate.name === nodeName),
    0,
  );
  const primitive = item(item(json.meshes, node.mesh ?? -1).primitives, 0);
  const position = dataOf(primitive.attributes.POSITION ?? -1);
  const normal = dataOf(primitive.attributes.NORMAL ?? -1);
  const index = dataOf(primitive.indices ?? -1);
  const scale = item(node.scale ?? [], 0);
  const stored = Array.from({ length: position.accessor.count }, (_, vertex) =>
    [0, 1, 2].map((axis) =>
      binary.readInt16LE(position.offset + vertex * position.stride + axis * 2),
    ),
  );
  const normals = Array.from({ length: normal.accessor.count }, (_, vertex) =>
    [0, 1, 2].map((axis) =>
      Math.max(-1, binary.readInt8(normal.offset + vertex * normal.stride + axis) / 127),
    ),
  );
  const readIndex = (at: number) =>
    index.accessor.componentType === UNSIGNED_INT
      ? binary.readUInt32LE(index.offset + at * 4)
      : binary.readUInt16LE(index.offset + at * 2);
  const triangles = Array.from({ length: index.accessor.count / 3 }, (_, triangle) => [
    readIndex(triangle * 3),
    readIndex(triangle * 3 + 1),
    readIndex(triangle * 3 + 2),
  ]);
  const metres = stored.map((row) =>
    row.map((value, axis) => item(node.translation ?? [], axis) + (value / POSITION_RANGE) * scale),
  );
  return { stored, metres, normals, triangles };
}

function subtract(a: number[], b: number[]): number[] {
  return a.map((value, axis) => value - item(b, axis));
}

function cross(a: number[], b: number[]): number[] {
  return [
    item(a, 1) * item(b, 2) - item(a, 2) * item(b, 1),
    item(a, 2) * item(b, 0) - item(a, 0) * item(b, 2),
    item(a, 0) * item(b, 1) - item(a, 1) * item(b, 0),
  ];
}

function length(a: number[]): number {
  return Math.hypot(...a);
}

describe("the integers stored in dist/male.glb", () => {
  it.each(EXPECTED_NAMES)("should decode %s to the bounds its accessor declares", (name) => {
    const { stored } = decodeMesh(name);
    const node = item(
      sceneNodes().filter((candidate) => candidate.name === name),
      0,
    );
    const primitive = item(item(json.meshes, node.mesh ?? -1).primitives, 0);
    const accessor = item(json.accessors, primitive.attributes.POSITION ?? -1);
    const lows = [0, 1, 2].map((axis) => Math.min(...stored.map((row) => item(row, axis))));
    const highs = [0, 1, 2].map((axis) => Math.max(...stored.map((row) => item(row, axis))));

    expect(lows).toEqual(accessor.min);
    expect(highs).toEqual(accessor.max);
    expect(Math.max(...lows.map(Math.abs), ...highs.map(Math.abs))).toBe(POSITION_RANGE);
  });

  it.each(EXPECTED_NAMES)("should index only vertices that exist in %s", (name) => {
    const { stored, triangles } = decodeMesh(name);

    expect(Math.max(...triangles.flat())).toBeLessThan(stored.length);
  });

  it.each(EXPECTED_NAMES)("should store unit normals that agree with the faces of %s", (name) => {
    const { metres, normals, triangles } = decodeMesh(name);
    const lengths = normals.map(length);
    const agreement: number[] = [];
    triangles.forEach(([a = 0, b = 0, c = 0]) => {
      const faceNormal = cross(
        subtract(item(metres, b), item(metres, a)),
        subtract(item(metres, c), item(metres, a)),
      );
      const faceLength = length(faceNormal);
      if (faceLength === 0) {
        return;
      }
      const average = [0, 1, 2].map(
        (axis) =>
          item(item(normals, a), axis) +
          item(item(normals, b), axis) +
          item(item(normals, c), axis),
      );
      agreement.push(
        average.reduce(
          (sum, value, axis) => sum + (value * item(faceNormal, axis)) / faceLength,
          0,
        ) / Math.max(length(average), 1e-9),
      );
    });
    const meanAgreement = agreement.reduce((sum, value) => sum + value, 0) / agreement.length;

    expect(lengths.reduce((sum, value) => sum + value, 0) / lengths.length).toBeGreaterThan(0.97);
    expect(Math.max(...lengths)).toBeLessThan(1.02);
    expect(meanAgreement).toBeGreaterThan(0.7);
  });
});

describe("dist/male.glb", () => {
  it("should keep the skin to 10,000 to 15,000 triangles and the head and eyes to 15,000 together", () => {
    const counts = trianglesByName();

    expect(counts.skin).toBeGreaterThanOrEqual(10_000);
    expect(counts.skin).toBeLessThanOrEqual(15_000);
    expect((counts.head ?? 0) + (counts.eyes ?? 0)).toBeLessThanOrEqual(15_000);
  });

  it("should use KHR_mesh_quantization and no other extension", () => {
    expect(json.extensionsUsed).toEqual(["KHR_mesh_quantization"]);
    expect(json.extensionsRequired).toEqual(["KHR_mesh_quantization"]);
  });

  it("should have normals on every mesh and vertex colours on the eyes only", () => {
    sceneNodes().forEach((node) => {
      const attributes = Object.keys(
        item(item(json.meshes, node.mesh ?? -1).primitives, 0).attributes,
      ).sort();

      expect(attributes).toEqual(
        node.name === "eyes" ? ["COLOR_0", "NORMAL", "POSITION"] : ["NORMAL", "POSITION"],
      );
    });
  });

  it("should name its generator and nothing that changes between runs", () => {
    expect(json.asset.generator).toBe("Ki-Lo body-model zanatomy_export");
  });
});

describe("dist/LICENCE.md", () => {
  const notice = readFileSync(join(distFolder, "LICENCE.md"), "utf8");

  it("should link the licence", () => {
    expect(notice).toContain("https://creativecommons.org/licenses/by-sa/4.0/");
  });

  it("should name the sources", () => {
    expect(notice).toContain("https://github.com/Z-Anatomy/Models-of-human-anatomy");
    expect(notice).toContain("22d77228e500b88a2e4802c1135e75c8834cdaaa");
    expect(notice).toContain("human-base-meshes-bundle-v1.4.1");
  });
});
