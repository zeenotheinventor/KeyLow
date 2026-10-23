import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const blenderFolder = join(import.meta.dirname, "../blender");
const repositoryRoot = join(import.meta.dirname, "../../..");

/** The checks are pure Python in zanatomy_common.py, so the tests run them with python3 as the Blender steps would. */
function runPython(code: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    "python3",
    ["-I", "-c", `import sys; sys.path.insert(0, ${JSON.stringify(blenderFolder)})\n${code}`],
    { encoding: "utf8" },
  );
  if (result.error) {
    throw new Error("python3 is required to test blender/zanatomy_common.py");
  }
  return result;
}

function workFolderProblem(path: string, root: string = repositoryRoot): string {
  const result = runPython(
    `import zanatomy_common as common, json\nprint(json.dumps(common.work_folder_problem(${JSON.stringify(path)}, ${JSON.stringify(root)})))`,
  );
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

describe("work_folder_problem", () => {
  it("refuses the repository root itself", () => {
    expect(workFolderProblem(repositoryRoot)).toContain("outside the repository");
  });

  it("refuses a folder inside the package", () => {
    expect(workFolderProblem(join(repositoryRoot, "tools/body-model/scratch"))).toContain(
      "outside the repository",
    );
  });

  it("refuses a folder in the repository's tools folder, which is not the root", () => {
    expect(workFolderProblem(join(repositoryRoot, "tools/scratch"))).toContain(
      "outside the repository",
    );
  });

  it("refuses a path that climbs out and back into the repository", () => {
    expect(workFolderProblem(`${repositoryRoot}/tools/../tools/body-model/work`)).toContain(
      "outside the repository",
    );
  });

  it("allows a sibling folder whose name only starts like the repository's", () => {
    expect(workFolderProblem(`${repositoryRoot}-scratch/work`)).toBe("null");
  });

  it("allows a folder outside the repository", () => {
    expect(workFolderProblem(join(tmpdir(), "body-model-work"))).toBe("null");
  });

  it("refuses a symbolic link that points into the repository", () => {
    const outside = mkdtempSync(join(tmpdir(), "body-model-link-"));
    const link = join(outside, "work");
    symlinkSync(join(repositoryRoot, "tools"), link);

    expect(workFolderProblem(link)).toContain("outside the repository");
  });
});

describe("zanatomy_file_problem", () => {
  it("accepts a file with the expected hash and refuses any other", () => {
    const folder = mkdtempSync(join(tmpdir(), "body-model-hash-"));
    const file = join(folder, "Startup.blend");
    mkdirSync(folder, { recursive: true });
    writeFileSync(file, "abc");
    const abcSha256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    const check = (expected: string) =>
      runPython(
        `import zanatomy_common as common, json\nprint(json.dumps(common.file_hash_problem(${JSON.stringify(file)}, ${JSON.stringify(expected)})))`,
      ).stdout.trim();

    expect(check(abcSha256)).toBe("null");
    expect(check("0".repeat(64))).toContain("sha256");
  });
});
