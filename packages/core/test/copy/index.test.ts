import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// The copy index is one `export *` line per module and is merged by git's union driver (see
// .gitattributes), so two branches that each add a module rebase without a conflict locally. A union
// merge can also keep a line twice, or keep the line of a module that another branch removed, and a
// module can be added without its line. This fails on any of those, so the index cannot reach main
// wrong.
const copyDirectory = path.join(import.meta.dirname, "..", "..", "src", "copy");
const notInBarrelMarker = "// @not-in-barrel";

const moduleNames = readdirSync(copyDirectory)
  .filter((file) => file.endsWith(".ts") && file !== "index.ts")
  .filter(
    (file) => !readFileSync(path.join(copyDirectory, file), "utf8").startsWith(notInBarrelMarker),
  )
  .map((file) => file.replace(/\.ts$/, ""))
  .sort();

const indexLines = readFileSync(path.join(copyDirectory, "index.ts"), "utf8")
  .split("\n")
  .filter((line) => line.trim() !== "");
const exportLinePattern = /^export \* from "\.\/(\w+)";$/;

describe("the copy index", () => {
  it('should be one `export * from "./module";` line per module and nothing else', () => {
    expect(indexLines.filter((line) => !exportLinePattern.test(line))).toEqual([]);
  });

  it("should list no module twice", () => {
    const listed = indexLines.map((line) => exportLinePattern.exec(line)?.[1]);

    expect(listed.filter((name, position) => listed.indexOf(name) !== position)).toEqual([]);
  });

  it("should list every module in src/copy that is not marked not-in-barrel", () => {
    const listed = indexLines.flatMap((line) => exportLinePattern.exec(line)?.[1] ?? []);

    expect(moduleNames.filter((name) => !listed.includes(name))).toEqual([]);
  });

  it("should list no module that does not exist", () => {
    const listed = indexLines.flatMap((line) => exportLinePattern.exec(line)?.[1] ?? []);

    expect(listed.filter((name) => !moduleNames.includes(name))).toEqual([]);
  });
});
