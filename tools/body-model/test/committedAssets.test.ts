import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readGlb } from "../src/glb.ts";
import { trianglesByMeshName, verifyGlbFile } from "../src/verifyGlb.ts";

const distFolder = join(import.meta.dirname, "../dist");
const committedGlbs = readdirSync(distFolder).filter((file) => file.endsWith(".glb"));

describe("the glb files committed in dist/", () => {
  it("should include male.glb", () => {
    expect(committedGlbs).toContain("male.glb");
  });

  it.each(committedGlbs)("should follow the asset contract: %s", (file) => {
    const path = join(distFolder, file);
    const triangles = trianglesByMeshName(readGlb(readFileSync(path)).json);
    console.info(`${file} triangles per mesh`, triangles);

    expect(verifyGlbFile(path)).toEqual([]);
  });
});
