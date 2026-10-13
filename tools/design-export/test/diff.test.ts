import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

import { differingPixelPercent } from "../src/diff.ts";

function solidPng(
  width: number,
  height: number,
  [red, green, blue]: [number, number, number],
): Buffer {
  const png = new PNG({ width, height });
  for (let index = 0; index < width * height; index += 1) {
    png.data[index * 4] = red;
    png.data[index * 4 + 1] = green;
    png.data[index * 4 + 2] = blue;
    png.data[index * 4 + 3] = 255;
  }
  return PNG.sync.write(png);
}

describe("differingPixelPercent", () => {
  it("should be zero for identical images", () => {
    expect(differingPixelPercent(solidPng(10, 10, [0, 0, 0]), solidPng(10, 10, [0, 0, 0]))).toBe(0);
  });

  it("should be 100 when every pixel differs", () => {
    expect(
      differingPixelPercent(solidPng(10, 10, [0, 0, 0]), solidPng(10, 10, [255, 255, 255])),
    ).toBe(100);
  });

  it("should count the share of pixels that differ", () => {
    const base = new PNG({ width: 10, height: 10 });
    base.data.fill(255);
    const changed = new PNG({ width: 10, height: 10 });
    changed.data.fill(255);
    for (let index = 0; index < 5; index += 1) {
      changed.data[index * 4] = 0;
      changed.data[index * 4 + 1] = 0;
      changed.data[index * 4 + 2] = 0;
    }
    expect(differingPixelPercent(PNG.sync.write(base), PNG.sync.write(changed))).toBe(5);
  });

  it("should reject images of different sizes", () => {
    expect(() =>
      differingPixelPercent(solidPng(10, 10, [0, 0, 0]), solidPng(10, 12, [0, 0, 0])),
    ).toThrow(/10x10.*10x12/);
  });
});
