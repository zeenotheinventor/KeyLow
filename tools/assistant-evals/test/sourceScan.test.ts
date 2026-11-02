import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const packageRoot = join(import.meta.dirname, "..");

const filesUnder = (folder: string): string[] =>
  readdirSync(join(packageRoot, folder), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => join(entry.parentPath, entry.name));

const sourceFiles = [...filesUnder("src"), ...filesUnder("fixtures")];

describe("the sources of the eval harness", () => {
  it("should never read a file, so a key file cannot be read", () => {
    const readers = sourceFiles.filter((file) =>
      /from "node:fs|from "fs"|readFile/.test(readFileSync(file, "utf8")),
    );

    expect(readers).toStrictEqual([]);
  });

  it("should hold no Anthropic key", () => {
    // Built from parts, so this file does not contain the prefix it looks for.
    const keyPrefix = ["sk", "ant", ""].join("-");
    const withKey = [...sourceFiles, ...filesUnder("test")].filter((file) =>
      readFileSync(file, "utf8").includes(keyPrefix),
    );

    expect(withKey).toStrictEqual([]);
  });
});
