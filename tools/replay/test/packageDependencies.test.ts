import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

const dependencyList = z.record(z.string(), z.string()).default({});

const packageJsonSchema = z.object({
  private: z.boolean(),
  dependencies: dependencyList,
  devDependencies: dependencyList,
  peerDependencies: dependencyList,
  optionalDependencies: dependencyList,
});

const packageJson = packageJsonSchema.parse(
  JSON.parse(readFileSync(join(import.meta.dirname, "../package.json"), "utf8")),
);

describe("the replay package", () => {
  it("should depend on @keylow/core and zod at run time and on nothing else", () => {
    expect(Object.keys(packageJson.dependencies).sort()).toStrictEqual(["@keylow/core", "zod"]);
  });

  it("should have no Supabase dependency of any kind", () => {
    const everyName = [
      packageJson.dependencies,
      packageJson.devDependencies,
      packageJson.peerDependencies,
      packageJson.optionalDependencies,
    ].flatMap((dependencies) => Object.keys(dependencies));

    expect(everyName.filter((name) => name.toLowerCase().includes("supabase"))).toStrictEqual([]);
  });

  it("should be private, so it is never published", () => {
    expect(packageJson.private).toBe(true);
  });
});
