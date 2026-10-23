import { describe, expect, it } from "vitest";

import { item, readGlb, writeGlb } from "../src/glb.ts";
import { quantiseGlb } from "../src/quantiseGlb.ts";

const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;
const SHORT = 5122;
const BYTE = 5120;

const options = { generator: "test generator", copyright: "test copyright" };

/** One mesh per name, each on its own node: a triangle spread over 2 m in x, with a normal per vertex. */
function buildTriangleGlb(names: string[] = ["thing"]): Buffer {
  const positions = new Float32Array([-1, 0, 0, 1, 0, 0, 0, 0.5, 0.25]);
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const indices = new Uint16Array([0, 1, 2, 0]);
  const oneMeshBinary = Buffer.concat([
    Buffer.from(positions.buffer),
    Buffer.from(normals.buffer),
    Buffer.from(indices.buffer),
  ]);
  const json = {
    asset: { version: "2.0", generator: "someone else" },
    scene: 0,
    scenes: [{ nodes: names.map((_name, index) => index) }],
    nodes: names.map((name, index) => ({ name, mesh: index })),
    meshes: names.map((name, index) => ({
      name,
      primitives: [
        { attributes: { POSITION: index * 3, NORMAL: index * 3 + 1 }, indices: index * 3 + 2 },
      ],
    })),
    accessors: names.flatMap((_name, index) => [
      {
        bufferView: index * 3,
        componentType: FLOAT,
        count: 3,
        type: "VEC3",
        min: [-1, 0, 0],
        max: [1, 0.5, 0.25],
      },
      { bufferView: index * 3 + 1, componentType: FLOAT, count: 3, type: "VEC3" },
      { bufferView: index * 3 + 2, componentType: UNSIGNED_SHORT, count: 3, type: "SCALAR" },
    ]),
    bufferViews: names.flatMap((_name, index) => [
      { buffer: 0, byteOffset: index * 78 + 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: index * 78 + 36, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: index * 78 + 72, byteLength: 6, target: 34963 },
    ]),
    buffers: [{ byteLength: oneMeshBinary.length * names.length }],
  };
  return writeGlb(json, Buffer.concat(names.map(() => oneMeshBinary)));
}

function quantisedTriangle() {
  const { json, binary } = readGlb(quantiseGlb(buildTriangleGlb(), options));
  const described = (index: number) => {
    const accessor = item(json.accessors, index);
    return { accessor, view: item(json.bufferViews, accessor.bufferView ?? -1) };
  };
  return {
    json,
    binary,
    node: item(json.nodes, 0),
    positions: described(0),
    normals: described(1),
    indices: described(2),
  };
}

describe("quantiseGlb", () => {
  it("should store positions as normalised 16 bit integers", () => {
    const { positions } = quantisedTriangle();

    expect(positions.accessor).toMatchObject({
      componentType: SHORT,
      normalized: true,
      type: "VEC3",
    });
  });

  it("should restore the positions with the scale and translation of the node", () => {
    const { binary, node, positions } = quantisedTriangle();
    const stored = new Int16Array(
      binary.buffer,
      binary.byteOffset + (positions.view.byteOffset ?? 0),
      12,
    );
    const restoredX = [0, 1, 2].map(
      (vertex) =>
        (item(stored, vertex * 4) / 32767) * item(node.scale ?? [], 0) +
        item(node.translation ?? [], 0),
    );

    expect(restoredX[0]).toBeCloseTo(-1, 4);
    expect(restoredX[1]).toBeCloseTo(1, 4);
    expect(restoredX[2]).toBeCloseTo(0, 4);
  });

  it("should use one scale for all three axes, so the normals stay right", () => {
    const { node } = quantisedTriangle();

    expect(new Set(node.scale).size).toBe(1);
  });

  it("should pad a three component integer vertex to four bytes", () => {
    const { positions, normals } = quantisedTriangle();

    expect(positions.view.byteStride).toBe(8);
    expect(normals.view.byteStride).toBe(4);
  });

  it("should store normals as normalised bytes", () => {
    const { binary, normals } = quantisedTriangle();
    const stored = new Int8Array(
      binary.buffer,
      binary.byteOffset + (normals.view.byteOffset ?? 0),
      4,
    );

    expect(normals.accessor).toMatchObject({ componentType: BYTE, normalized: true, type: "VEC3" });
    expect(Array.from(stored.subarray(0, 3))).toEqual([0, 0, 127]);
  });

  it("should write the integer bounds of the positions into the accessor", () => {
    const { positions } = quantisedTriangle();

    expect(positions.accessor.min).toEqual([-32767, -8192, -4096]);
    expect(positions.accessor.max).toEqual([32767, 8192, 4096]);
  });

  it("should keep the indices as they were", () => {
    const { binary, indices } = quantisedTriangle();
    const stored = new Uint16Array(
      binary.buffer,
      binary.byteOffset + (indices.view.byteOffset ?? 0),
      3,
    );

    expect(Array.from(stored)).toEqual([0, 1, 2]);
  });

  it("should list KHR_mesh_quantization as the only extension, used and required", () => {
    const { json } = quantisedTriangle();

    expect(json.extensionsUsed).toEqual(["KHR_mesh_quantization"]);
    expect(json.extensionsRequired).toEqual(["KHR_mesh_quantization"]);
  });

  it("should set the generator and the copyright", () => {
    const { json } = quantisedTriangle();

    expect(json.asset).toMatchObject({ generator: "test generator", copyright: "test copyright" });
  });

  it("should give the same bytes twice", () => {
    expect(
      quantiseGlb(buildTriangleGlb(), options).equals(quantiseGlb(buildTriangleGlb(), options)),
    ).toBe(true);
  });

  it("should keep a normalised colour attribute as it was", () => {
    const { json, binary } = readGlb(buildTriangleGlb());
    const colours = new Uint16Array([65535, 0, 0, 65535, 0, 65535, 0, 65535, 0, 0, 65535, 65535]);
    const view = { buffer: 0, byteOffset: binary.length, byteLength: 24, target: 34962 };
    json.bufferViews.push(view);
    json.accessors.push({
      bufferView: json.bufferViews.length - 1,
      componentType: UNSIGNED_SHORT,
      normalized: true,
      count: 3,
      type: "VEC4",
    });
    item(item(json.meshes, 0).primitives, 0).attributes.COLOR_0 = json.accessors.length - 1;
    json.buffers[0] = { byteLength: binary.length + 24 };
    const out = readGlb(
      quantiseGlb(writeGlb(json, Buffer.concat([binary, Buffer.from(colours.buffer)])), options),
    );
    const colour = item(out.json.accessors, 3);

    expect(colour).toMatchObject({ componentType: UNSIGNED_SHORT, normalized: true, type: "VEC4" });
  });

  it("should list the scene nodes in the order asked for", () => {
    const { json } = readGlb(
      quantiseGlb(buildTriangleGlb(["b", "c", "a"]), { ...options, nodeOrder: ["a", "b", "c"] }),
    );
    const sceneNames = (json.scenes?.[0]?.nodes ?? []).map((index) => item(json.nodes, index).name);

    expect(sceneNames).toEqual(["a", "b", "c"]);
  });

  it("should keep an extension that was already used and add its own", () => {
    const { json, binary } = readGlb(buildTriangleGlb());
    json.extensionsUsed = ["KHR_materials_unlit"];
    json.extensionsRequired = ["KHR_texture_basisu"];
    const out = readGlb(quantiseGlb(writeGlb(json, binary), options)).json;

    expect(out.extensionsUsed).toEqual(["KHR_materials_unlit", "KHR_mesh_quantization"]);
    expect(out.extensionsRequired).toEqual(["KHR_texture_basisu", "KHR_mesh_quantization"]);
  });

  it("should refuse positions that are not 32 bit floats", () => {
    const { json, binary } = readGlb(buildTriangleGlb());
    item(json.accessors, 0).componentType = SHORT;

    expect(() => quantiseGlb(writeGlb(json, binary), options)).toThrow(/float/);
  });

  it("should refuse normals that are not 32 bit floats", () => {
    const { json, binary } = readGlb(buildTriangleGlb());
    item(json.accessors, 1).componentType = BYTE;

    expect(() => quantiseGlb(writeGlb(json, binary), options)).toThrow(/float/);
  });

  it("should refuse a node that already has a transform", () => {
    const { json, binary } = readGlb(buildTriangleGlb());
    item(json.nodes, 0).translation = [0, 1, 0];

    expect(() => quantiseGlb(writeGlb(json, binary), options)).toThrow(/transform/);
  });
});
