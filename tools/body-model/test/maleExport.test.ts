import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readRawGlb, removeStaleRawGlb } from "../src/maleExport.ts";

const packageFolder = join(import.meta.dirname, "..");

function newWorkFolder(): string {
  return mkdtempSync(join(tmpdir(), "body-model-export-"));
}

describe("removeStaleRawGlb", () => {
  it("should delete a raw file left by an earlier run", () => {
    const work = newWorkFolder();
    writeFileSync(join(work, "male-raw.glb"), "old");

    removeStaleRawGlb(work);

    expect(existsSync(join(work, "male-raw.glb"))).toBe(false);
  });

  it("should do nothing when there is no raw file", () => {
    expect(() => {
      removeStaleRawGlb(newWorkFolder());
    }).not.toThrow();
  });
});

describe("readRawGlb", () => {
  it("should fail when Blender left no raw file", () => {
    expect(() => readRawGlb(newWorkFolder())).toThrow(/male-raw\.glb/);
  });

  it("should return the bytes of the raw file", () => {
    const work = newWorkFolder();
    writeFileSync(join(work, "male-raw.glb"), "new");

    expect(readRawGlb(work).toString()).toBe("new");
  });
});

describe("pnpm export when Blender exits 0 without writing a file", () => {
  it("should fail and leave dist/male.glb alone, even with a stale raw file in the work folder", () => {
    const work = newWorkFolder();
    writeFileSync(join(work, "male-raw.glb"), "stale");
    const fakeBlender = join(work, "fake-blender.sh");
    writeFileSync(fakeBlender, "#!/bin/sh\nexit 0\n");
    chmodSync(fakeBlender, 0o755);
    const distFile = join(packageFolder, "dist", "male.glb");
    const before = readFileSync(distFile);
    const modifiedBefore = statSync(distFile).mtimeMs;

    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", join(packageFolder, "src", "exportMale.ts"), "--work", work],
      { env: { ...process.env, BLENDER: fakeBlender }, encoding: "utf8" },
    );

    expect(result.status).not.toBe(0);
    expect(readFileSync(distFile).equals(before)).toBe(true);
    expect(statSync(distFile).mtimeMs).toBe(modifiedBefore);
  });
});
