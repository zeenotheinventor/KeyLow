import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const packageFolder = join(import.meta.dirname, "..");
const { scripts, exports } = JSON.parse(
  readFileSync(join(packageFolder, "package.json"), "utf8"),
) as {
  scripts: Record<string, string>;
  exports: Record<string, string>;
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

  it("includes the phone render step", () => {
    expect(blenderScripts.map(([name]) => name)).toContain("zanatomy:phone-render");
  });

  it("exports the phone model with a script that is not named build", () => {
    expect(scripts.export).toContain("src/exportMale.ts");
  });

  it("exports the one committed copy of the phone model", () => {
    expect(exports["./male.glb"]).toBe("./dist/male.glb");
  });

  it("runs the export through runBlender, so it gets the safety flags", () => {
    const source = readFileSync(join(packageFolder, "src", "exportMale.ts"), "utf8");

    expect(source).toContain('import { runBlender } from "./runBlender.ts"');
    expect(source).toContain('runBlender("zanatomy_export"');
    expect(source).not.toContain("child_process");
    expect(existsSync(join(packageFolder, "blender", "zanatomy_export.py"))).toBe(true);
  });

  it("has no build script, because CI has no Blender", () => {
    expect(scripts).not.toHaveProperty("build");
  });

  it.each(blenderScripts)("%s goes through run.ts to a script that exists", (_name, command) => {
    const scriptName = command.split("src/run.ts ")[1];

    expect(existsSync(join(packageFolder, "blender", `${scriptName}.py`))).toBe(true);
  });
});
