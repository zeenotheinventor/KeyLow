import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const uiDirectory = join(__dirname, "../../components/ui");
const sourceFiles = readdirSync(uiDirectory, { recursive: true, encoding: "utf8" }).filter((name) =>
  /\.(ts|tsx)$/.test(name),
);

describe("the kit's source", () => {
  it.each(sourceFiles)("%s should use tokens only", (name) => {
    const source = readFileSync(join(uiDirectory, name), "utf8");

    expect(source).not.toMatch(/\sstyle=/);
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/legacy-/);
    expect(source).not.toContain("—");
  });
});
