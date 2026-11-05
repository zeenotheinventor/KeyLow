import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

// Nothing may reach three.js, react-three-fiber, the model or the body renderer's root except the files of the
// lazy folder, which `Body3D` loads on first use. A route that imported any of them would carry them in its first
// load. The subpaths of the renderer that hold no three.js (touch, rotation and zoom) stay allowed everywhere.
const webRoot = join(__dirname, "../..");
const searchedFolders = ["app", "components"];
const lazyFolder = join("components", "ui", "Body3D", "Body3DCanvas");

const forbiddenSpecifier =
  /^(three(\/.*)?|@react-three\/fiber(\/.*)?|@keylow\/body-model(\/.*)?|@keylow\/body-3d)$/;

/** Every module specifier a source file imports, statically or with `import()`, or requires. */
function specifiersOf(source: string): string[] {
  const importPattern =
    /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*|\bnew\s+URL\s*\(\s*)["']([^"']+)["']/g;
  return [...source.matchAll(importPattern)].flatMap(([, specifier]) =>
    specifier === undefined ? [] : [specifier],
  );
}

function forbiddenImportsOf(source: string): string[] {
  return specifiersOf(source).filter((specifier) => forbiddenSpecifier.test(specifier));
}

/**
 * A static import of the lazy folder or of any file in it, which `import type` and `import()` are not, because they
 * leave nothing in the bundle. A re-export and a bare `import "..."` count, because both pull the module in.
 */
function importsLazyFolderStatically(source: string): boolean {
  const lazyFolderSpecifier = String.raw`["'][^"']*Body3DCanvas(?:\/[^"']*)?["']`;
  const withBindings = new RegExp(
    String.raw`^(?:import|export)\s+(?!type\b)[^;]*?from\s*${lazyFolderSpecifier}`,
    "m",
  );
  const bare = new RegExp(String.raw`^import\s*${lazyFolderSpecifier}`, "m");
  return withBindings.test(source) || bare.test(source);
}

const sourceFiles = searchedFolders.flatMap((folder) =>
  readdirSync(join(webRoot, folder), { recursive: true, encoding: "utf8" })
    .filter((name) => /\.(ts|tsx)$/.test(name))
    .map((name) => relative(webRoot, join(webRoot, folder, name))),
);
const outsideTheLazyFolder = sourceFiles.filter((file) => !file.startsWith(lazyFolder + sep));

describe("the lazy boundary of the 3D body", () => {
  it("should search the app and the components", () => {
    expect(sourceFiles.length).toBeGreaterThan(100);
    expect(sourceFiles).toContain(join(lazyFolder, "Body3DCanvas.tsx"));
  });

  it("should keep three.js, react-three-fiber, the model and the renderer's root in the lazy folder", () => {
    const lazySources = sourceFiles
      .filter((file) => file.startsWith(lazyFolder + sep))
      .map((file) => readFileSync(join(webRoot, file), "utf8"));

    // The folder is the only place that does reach them, which shows the search below can find them.
    // It reaches three.js through the renderer's root.
    expect(lazySources.flatMap(forbiddenImportsOf)).toEqual(
      expect.arrayContaining([
        "@react-three/fiber",
        "@keylow/body-3d",
        "@keylow/body-model/male.glb",
      ]),
    );
  });

  it.each(outsideTheLazyFolder)("%s should not import any of them", (file) => {
    expect(forbiddenImportsOf(readFileSync(join(webRoot, file), "utf8"))).toEqual([]);
  });

  it.each(outsideTheLazyFolder)("%s should reach the lazy folder only with import()", (file) => {
    expect(importsLazyFolderStatically(readFileSync(join(webRoot, file), "utf8"))).toBe(false);
  });

  describe("the check", () => {
    it.each([
      'import { Canvas } from "@react-three/fiber";',
      'import { Canvas } from "@react-three/fiber/native";',
      'import { Mesh } from "three";',
      'import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";',
      'import { loadBodyModel } from "@keylow/body-3d";',
      'const url = import("@keylow/body-model/male.glb");',
      'import "@keylow/body-model/male.glb";',
      'const three = require("three");',
      'const url = new URL("@keylow/body-model/male.glb", import.meta.url);',
    ])("should flag %s", (source) => {
      expect(forbiddenImportsOf(source)).toHaveLength(1);
    });

    it.each([
      'import { BODY_TAP_SLOP } from "@keylow/body-3d/touch";',
      'import type { BodySide } from "@keylow/body-3d/rotation";',
      'import { cameraShift } from "@keylow/body-3d/zoom";',
      'import { threeColumns } from "./three";',
      'import { x } from "@keylow/core/training";',
    ])("should allow %s", (source) => {
      expect(forbiddenImportsOf(source)).toEqual([]);
    });

    it.each([
      'import { Body3DCanvas } from "./Body3DCanvas";',
      'import { maleBodyModel } from "./Body3DCanvas/bodyModel";',
      'import { Body3DCanvas } from "./Body3DCanvas/Body3DCanvas";',
      'import { Body3DCanvas } from "@/components/ui/Body3D/Body3DCanvas";',
      'import "./Body3DCanvas/bodyModel";',
      'export { Body3DCanvas } from "./Body3DCanvas";',
      'import {\n  maleBodyModel,\n} from "./Body3DCanvas/bodyModel";',
    ])("should flag the static import %s", (source) => {
      expect(importsLazyFolderStatically(source)).toBe(true);
    });

    it.each([
      'import type { Body3DCanvasProps } from "./Body3DCanvas";',
      'import type { Body3DCanvasProps } from "./Body3DCanvas/types";',
      'const lazy = () => import("./Body3DCanvas");',
      'const lazy = () => import("./Body3DCanvas/bodyModel");',
      'import { Body3DBoundary } from "./Body3DBoundary";',
    ])("should allow %s", (source) => {
      expect(importsLazyFolderStatically(source)).toBe(false);
    });
  });
});
