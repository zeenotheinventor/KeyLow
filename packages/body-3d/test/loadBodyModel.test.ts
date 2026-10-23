import { readFileSync } from "node:fs";

import { Box3, Mesh } from "three";
import { describe, expect, it } from "vitest";

import { loadBodyModel } from "../src";

import type { Vector3 } from "three";

const fixture = readFileSync(new URL("./fixtures/quantised-cube.glb", import.meta.url));

// Node hands out a view on a shared pool, so the glb is copied into a buffer of its own.
const glbBytes = () => new Uint8Array(fixture).buffer;

// 16 bit positions are exact to about 0.00003 of the box, so rounding to three decimal places gives the
// box they were made from. Adding zero turns a rounded -0 into 0.
const rounded = (corner: Vector3) =>
  corner.toArray().map((value) => Math.round(value * 1000) / 1000 + 0);

function expectBox(box: Box3, min: number[], max: number[]) {
  expect(rounded(box.min)).toEqual(min);
  expect(rounded(box.max)).toEqual(max);
}

describe("loadBodyModel", () => {
  it("returns each mesh of the file by its name", async () => {
    const model = await loadBodyModel(glbBytes());

    expect([...model.meshes.keys()].sort()).toEqual(["block-left", "block-right"]);
    for (const mesh of model.meshes.values()) {
      expect(mesh).toBeInstanceOf(Mesh);
    }
  });

  it("decodes the quantised positions to the box they were made from", async () => {
    const model = await loadBodyModel(glbBytes());

    const left = new Box3().setFromObject(model.meshes.get("block-left") ?? new Mesh());
    const right = new Box3().setFromObject(model.meshes.get("block-right") ?? new Mesh());

    expectBox(left, [-1.5, 0.5, -0.5], [-0.5, 1.5, 0.5]);
    expectBox(right, [0.5, 0, -0.5], [1.5, 1, 0.5]);
  });

  it("rejects bytes that are not a glb", async () => {
    await expect(loadBodyModel(new ArrayBuffer(16))).rejects.toThrow();
  });
});
