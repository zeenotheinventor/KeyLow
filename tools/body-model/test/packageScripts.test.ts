import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const packageFolder = join(import.meta.dirname, "..");
const { scripts } = JSON.parse(readFileSync(join(packageFolder, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};
const blenderScripts = Object.entries(scripts).filter(([, command]) =>
  command.includes("src/run.ts"),
);

describe("package scripts that run Blender", () => {
  it("includes the four Z-Anatomy steps", () => {
    expect(blenderScripts.map(([name]) => name)).toEqual(
      expect.arrayContaining([
        "zanatomy:muscles",
        "zanatomy:skin",
        "zanatomy:head",
        "zanatomy:render",
      ]),
    );
  });

  it("has no build script, because CI has no Blender", () => {
    expect(scripts).not.toHaveProperty("build");
  });

  it.each(blenderScripts)("%s goes through run.ts to a script that exists", (_name, command) => {
    const scriptName = command.split("src/run.ts ")[1];

    expect(existsSync(join(packageFolder, "blender", `${scriptName}.py`))).toBe(true);
  });
});
