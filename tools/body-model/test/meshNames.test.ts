import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";

import { MUSCLE_IDS } from "@keylow/core/training";
import { describe, expect, it } from "vitest";

import { BODY_MESH_NAMES } from "../src/meshNames.ts";

const packageFolder = join(import.meta.dirname, "..");

describe("BODY_MESH_NAMES", () => {
  it("should start with the 22 muscle ids in their order", () => {
    expect(BODY_MESH_NAMES.slice(0, MUSCLE_IDS.length)).toEqual([...MUSCLE_IDS]);
    expect(MUSCLE_IDS).toHaveLength(22);
  });

  it("should end with the five meshes that have no id", () => {
    expect(BODY_MESH_NAMES.slice(MUSCLE_IDS.length)).toEqual([
      "other",
      "skin",
      "core",
      "head",
      "eyes",
    ]);
  });

  it("should hold 27 distinct names", () => {
    expect(new Set(BODY_MESH_NAMES).size).toBe(27);
  });
});

describe("the meshNames entry", () => {
  it("should typecheck without allowImportingTsExtensions, as it does in the mobile app", () => {
    const result = spawnSync(
      process.execPath,
      [
        createRequire(import.meta.url).resolve("typescript/bin/tsc"),
        "--noEmit",
        "-p",
        join(packageFolder, "test", "fixtures", "tsconfig.meshNames.json"),
      ],
      { encoding: "utf8" },
    );

    expect(result.stdout).toBe("");
    expect(result.status).toBe(0);
  });
});
