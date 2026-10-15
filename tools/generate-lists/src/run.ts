import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildIconColorTones, buildIconMap } from "./iconLists.ts";
import { buildUiBarrel, isInternalToKit } from "./uiBarrel.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const mobileDirectory = path.join(repositoryRoot, "apps", "mobile");

function writeIfChanged(filePath: string, text: string): void {
  if (!existsSync(filePath) || readFileSync(filePath, "utf8") !== text) {
    writeFileSync(filePath, text);
  }
}

function generateUiBarrel(): void {
  const uiDirectory = path.join(mobileDirectory, "components", "ui");
  const kitFolders = readdirSync(uiDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter(
      (name) => !isInternalToKit(readFileSync(path.join(uiDirectory, name, "index.ts"), "utf8")),
    );
  writeIfChanged(path.join(uiDirectory, "index.ts"), buildUiBarrel(kitFolders));
}

function fileNamesIn(directory: string): string[] {
  return readdirSync(directory)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => file.replace(/\.ts$/, ""));
}

const iconDirectory = path.join(mobileDirectory, "components", "ui", "Icon");

function generateIconMap(): void {
  writeIfChanged(
    path.join(iconDirectory, "iconMap.ts"),
    buildIconMap(fileNamesIn(path.join(iconDirectory, "icons"))),
  );
}

function generateIconColorTones(): void {
  writeIfChanged(
    path.join(iconDirectory, "iconColorTones.ts"),
    buildIconColorTones(fileNamesIn(path.join(iconDirectory, "tones"))),
  );
}

// Metro writes this index when Storybook is on, but tsc, ESLint and Jest read it without Metro, so it
// is written here too, by Storybook's own command.
function generateStoryIndex(): void {
  execFileSync(
    path.join(repositoryRoot, "node_modules", ".bin", "sb-rn-get-stories"),
    ["--config-path", ".rnstorybook"],
    { cwd: mobileDirectory, stdio: "inherit" },
  );
}

const targets = process.argv.slice(2);
const generators: Record<string, () => void> = {
  "ui-barrel": generateUiBarrel,
  "icon-map": generateIconMap,
  "icon-tones": generateIconColorTones,
  "story-index": generateStoryIndex,
};

for (const target of targets.length > 0 ? targets : Object.keys(generators)) {
  const generate = generators[target];
  if (generate === undefined) {
    throw new Error(`Unknown target "${target}". Targets: ${Object.keys(generators).join(", ")}`);
  }
  generate();
}
