import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MUSCLE_IDS } from "../../../packages/core/src/training/muscles.ts";
import { item, readGlb } from "../src/glb.ts";
import { ATTRIBUTION_LINES } from "../src/maleExport.ts";

const distFolder = join(import.meta.dirname, "../dist");
const glbPath = join(distFolder, "male.glb");
const { json, binary } = readGlb(readFileSync(glbPath));
const EXPECTED_NAMES = [...MUSCLE_IDS, "other", "skin", "core", "head", "eyes"];
const POSITION_RANGE = 32767;
const UNSIGNED_INT = 5125;

function sceneNodes() {
  return (json.scenes?.[0]?.nodes ?? []).map((index) => item(json.nodes, index));
}

function triangleCount(meshIndex: number): number {
  const primitive = item(item(json.meshes, meshIndex).primitives, 0);
  return item(json.accessors, primitive.indices ?? -1).count / 3;
}

function trianglesByName(): Record<string, number> {
  const counts: Record<string, number> = {};
  sceneNodes().forEach((node) => {
    counts[node.name ?? ""] = triangleCount(node.mesh ?? -1);
  });
  return counts;
}

/** The world space bounds of one mesh: its node's translation plus scale times the normalised integer bounds. */
function worldBounds(nodeName: string): { low: number[]; high: number[] } {
  const node = item(
    sceneNodes().filter((candidate) => candidate.name === nodeName),
    0,
  );
  const primitive = item(item(json.meshes, node.mesh ?? -1).primitives, 0);
  const accessor = item(json.accessors, primitive.attributes.POSITION ?? -1);
  const place = (axis: number, stored: number) =>
    item(node.translation ?? [], axis) + (stored / POSITION_RANGE) * item(node.scale ?? [], axis);
  return {
    low: [0, 1, 2].map((axis) => place(axis, item(accessor.min ?? [], axis))),
    high: [0, 1, 2].map((axis) => place(axis, item(accessor.max ?? [], axis))),
  };
}

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
  it("should be at most 4 MB", () => {
    expect(statSync(glbPath).size).toBeLessThanOrEqual(4 * 1024 * 1024);
  });

  it("should hold the 27 meshes of the contract, once each, in order", () => {
    expect(sceneNodes().map((node) => node.name)).toEqual(EXPECTED_NAMES);
    expect(json.meshes.map((mesh) => mesh.name)).toHaveLength(27);
  });

  it("should draw at most 250,000 triangles", () => {
    const total = Object.values(trianglesByName()).reduce((sum, count) => sum + count, 0);

    expect(total).toBeLessThanOrEqual(250_000);
  });

  it.each(MUSCLE_IDS)("should give %s at least 1,000 triangles", (muscleId) => {
    expect(trianglesByName()[muscleId]).toBeGreaterThanOrEqual(1000);
  });

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

  it("should carry the licence and both attribution lines in asset.copyright", () => {
    expect(json.asset.copyright).toContain("CC BY-SA 4.0");
    ATTRIBUTION_LINES.forEach((line) => {
      expect(json.asset.copyright).toContain(line);
    });
  });

  it("should have no cameras, lights, animation, skins, textures or images", () => {
    expect(json.cameras).toBeUndefined();
    expect(json.animations).toBeUndefined();
    expect(json.skins).toBeUndefined();
    expect(json.textures).toBeUndefined();
    expect(json.images).toBeUndefined();
    expect(JSON.stringify(json)).not.toContain("KHR_lights");
  });

  it("should give every mesh its own material named mat_<name>", () => {
    const materialNames = sceneNodes().map((node) => {
      const primitive = item(item(json.meshes, node.mesh ?? -1).primitives, 0);
      return item(json.materials ?? [], primitive.material ?? -1).name;
    });

    expect(materialNames).toEqual(EXPECTED_NAMES.map((name) => `mat_${name}`));
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

  it("should stand on y = 0, centred on x and z, about 1.7 m tall", () => {
    const skin = worldBounds("skin");

    expect(
      Math.abs(Math.min(...EXPECTED_NAMES.map((name) => item(worldBounds(name).low, 1)))),
    ).toBeLessThan(0.002);
    expect(Math.abs((item(skin.low, 0) + item(skin.high, 0)) / 2)).toBeLessThan(0.002);
    expect(Math.abs((item(skin.low, 2) + item(skin.high, 2)) / 2)).toBeLessThan(0.002);
    expect(item(worldBounds("head").high, 1)).toBeGreaterThan(1.6);
    expect(item(worldBounds("head").high, 1)).toBeLessThan(1.8);
  });

  it("should face +z, so the eyes are in front of the middle of the body", () => {
    const eyes = worldBounds("eyes");

    expect((item(eyes.low, 2) + item(eyes.high, 2)) / 2).toBeGreaterThan(0.03);
  });

  it("should name its generator and nothing that changes between runs", () => {
    expect(json.asset.generator).toBe("Ki-Lo body-model zanatomy_export");
  });
});

describe("dist/LICENCE.md", () => {
  const notice = readFileSync(join(distFolder, "LICENCE.md"), "utf8");

  it.each(ATTRIBUTION_LINES)("should carry the line %s word for word", (line) => {
    expect(notice).toContain(line);
  });

  it("should link the licence", () => {
    expect(notice).toContain("https://creativecommons.org/licenses/by-sa/4.0/");
  });

  it("should name the sources", () => {
    expect(notice).toContain("https://github.com/Z-Anatomy/Models-of-human-anatomy");
    expect(notice).toContain("22d77228e500b88a2e4802c1135e75c8834cdaaa");
    expect(notice).toContain("human-base-meshes-bundle-v1.4.1");
  });
});
