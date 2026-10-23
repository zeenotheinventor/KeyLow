import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { verifyGlbFile } from "../src/verifyGlb.ts";

const packageFolder = join(import.meta.dirname, "..");
const committedGlb = join(packageFolder, "dist", "male.glb");

const scratchFolders: string[] = [];

afterAll(() => {
  scratchFolders.forEach((folder) => {
    rmSync(folder, { recursive: true, force: true });
  });
});

/** A scratch folder that holds a copy of the committed glb and nothing else. */
function folderWithGlb(): string {
  const folder = mkdtempSync(join(tmpdir(), "body-model-verify-"));
  scratchFolders.push(folder);
  copyFileSync(committedGlb, join(folder, "male.glb"));
  return folder;
}

function runVerify(...files: string[]) {
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--no-warnings",
      join(packageFolder, "src", "verify.ts"),
      ...files,
    ],
    { encoding: "utf8" },
  );
}

describe("verifyGlbFile", () => {
  it("should report a LICENCE.md that is not beside the glb", () => {
    expect(verifyGlbFile(join(folderWithGlb(), "male.glb"))).toContain(
      "LICENCE.md is missing beside the glb",
    );
  });

  it("should report a file that cannot be read", () => {
    const missing = join(folderWithGlb(), "nothing.glb");

    expect(verifyGlbFile(missing)).toEqual([`the file ${missing} cannot be read`]);
  });
});

describe("the verify script", () => {
  it("should exit 0 and say ok for the committed glb", () => {
    const result = runVerify(committedGlb);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("male.glb: ok");
  });

  it("should exit 1 and print the problems for a file that breaks the contract", () => {
    const broken = join(folderWithGlb(), "broken.glb");
    writeFileSync(broken, "not a glb");

    const result = runVerify(broken);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("the file is not a glTF binary");
  });

  it("should exit 2 when it is given no file", () => {
    expect(runVerify().status).toBe(2);
  });
});
