import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..", "..");

// These files are written by `pnpm generate:lists` and ignored by git. A committed copy would
// bring the merge conflicts back, because two branches would each change it.
const generatedFiles = [
  "apps/mobile/components/ui/index.ts",
  "apps/mobile/components/ui/Icon/iconMap.ts",
  "apps/mobile/components/ui/Icon/iconColorTones.ts",
  "apps/mobile/.rnstorybook/storybook.requires.ts",
];

describe("the generated files", () => {
  it.each(generatedFiles)("should not be committed: %s", (generatedFile) => {
    const tracked = execFileSync("git", ["ls-files", "--", generatedFile], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });

    expect(tracked, `${generatedFile} is tracked by git, remove it with git rm --cached`).toBe("");
  });
});
