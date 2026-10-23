// Remakes quantised-cube.glb: `pnpm --filter @keylow/body-3d make-fixture`.
//
// Two named boxes, quantised with KHR_mesh_quantization (16 bit positions, 16 bit normals), so a loader
// that cannot decode quantised attributes fails on it. Our own work, so no licence applies.
import { fileURLToPath } from "node:url";

import { Document, NodeIO } from "@gltf-transform/core";
import { KHRMeshQuantization } from "@gltf-transform/extensions";
import { quantize } from "@gltf-transform/functions";

import type { Primitive } from "@gltf-transform/core";

const FACES = [
  { normal: [1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { normal: [-1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { normal: [0, -1, 0], u: [0, 0, 1], v: [1, 0, 0] },
  { normal: [0, 0, 1], u: [0, 1, 0], v: [1, 0, 0] },
  { normal: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0] },
] as const;

// The four corners of a face, as steps along its two tangents from the face centre.
const CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const;

function boxArrays(centre: readonly [number, number, number], half: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (const face of FACES) {
    const first = positions.length / 3;
    for (const [stepU, stepV] of CORNERS) {
      for (let axis = 0; axis < 3; axis += 1) {
        positions.push(
          (centre[axis] ?? 0) +
            half *
              ((face.normal[axis] ?? 0) +
                stepU * (face.u[axis] ?? 0) +
                stepV * (face.v[axis] ?? 0)),
        );
      }
      normals.push(...face.normal);
    }
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }
  return { positions, normals, indices };
}

function addBox(
  document: Document,
  name: string,
  centre: readonly [number, number, number],
  half: number,
) {
  const buffer = document.getRoot().listBuffers()[0] ?? document.createBuffer();
  const { positions, normals, indices } = boxArrays(centre, half);
  const accessor = (array: Float32Array | Uint16Array, type: "VEC3" | "SCALAR") =>
    document.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const primitive: Primitive = document
    .createPrimitive()
    .setAttribute("POSITION", accessor(new Float32Array(positions), "VEC3"))
    .setAttribute("NORMAL", accessor(new Float32Array(normals), "VEC3"))
    .setIndices(accessor(new Uint16Array(indices), "SCALAR"));
  const mesh = document.createMesh(name).addPrimitive(primitive);
  return document.createNode(name).setMesh(mesh);
}

const document = new Document();
document.createBuffer();
const scene = document.createScene("quantised-cube");
// A tall block and a short one side by side, so the bounding box is not a cube centred on the origin.
scene.addChild(addBox(document, "block-left", [-1, 1, 0], 0.5));
scene.addChild(addBox(document, "block-right", [1, 0.5, 0], 0.5));

document.createExtension(KHRMeshQuantization).setRequired(true);
await document.transform(quantize());

const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
await io.write(fileURLToPath(new URL("./quantised-cube.glb", import.meta.url)), document);
