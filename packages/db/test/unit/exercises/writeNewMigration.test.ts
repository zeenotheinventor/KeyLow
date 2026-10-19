import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeNewMigration } from "../../../scripts/exercises/writeNewMigration";

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "write-new-migration-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("writeNewMigration", () => {
  it("should write the migration to a path that holds no file", () => {
    const path = join(directory, "20261019030000_exercise_library.sql");

    writeNewMigration(path, "select 1;\n");

    expect(readFileSync(path, "utf8")).toBe("select 1;\n");
  });

  it("should refuse to write over an existing file, and leave it as it was", () => {
    const path = join(directory, "20261019030000_exercise_library.sql");
    writeFileSync(path, "applied\n");

    expect(() => {
      writeNewMigration(path, "select 1;\n");
    }).toThrow("An applied migration is never regenerated: write a new timestamped file instead");
    expect(readFileSync(path, "utf8")).toBe("applied\n");
  });

  it("should pass on any other failure, such as a missing directory", () => {
    expect(() => {
      writeNewMigration(join(directory, "missing", "m.sql"), "x");
    }).toThrow(/ENOENT/);
  });
});
