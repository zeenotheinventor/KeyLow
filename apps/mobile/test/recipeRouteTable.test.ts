import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

import {
  archivedRecipesPath,
  editRecipePath,
  newRecipePath,
  logRecipePath,
  recipePath,
  recipesPath,
  refreshRecipePath,
} from "../lib/recipeRoutes";

// Every address a recipe screen sends the user to must be a file under app/, or the control that leads there
// opens the not-found screen. This is the table a later rename has to keep true.

const appDirectory = join(__dirname, "..", "app");
const routeFileExtension = /\.tsx?$/;
const SOME_RECIPE_ID = "0b5f4b6e-1c1b-4d6f-8f5e-3d2f6f0a9a11";

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? filesUnder(join(directory, entry.name))
      : [relative(appDirectory, join(directory, entry.name)).split(sep).join("/")],
  );
}

// The segments of the address a route file answers, as Expo Router reads its path: a group in brackets
// is not part of the address, and an index file is its folder's address.
function addressSegmentsOf(file: string): string[] {
  return file
    .replace(routeFileExtension, "")
    .split("/")
    .filter((segment) => !/^\(.*\)$/.test(segment))
    .filter((segment) => segment !== "index");
}

const isParameter = (segment: string) => /^\[.+\]$/.test(segment);

/** The route file an address opens: a fixed segment beats a parameter, as it does in the router. */
function routeFileFor(address: string): string | undefined {
  const wanted = address.split("?")[0]?.split("/").filter(Boolean) ?? [];
  const candidates = filesUnder(appDirectory)
    .filter((file) => routeFileExtension.test(file) && !file.endsWith("_layout.tsx"))
    .filter((file) => {
      const segments = addressSegmentsOf(file);
      return (
        segments.length === wanted.length &&
        segments.every((segment, place) => isParameter(segment) || segment === wanted[place])
      );
    });
  const fixedSegmentCount = (file: string) =>
    addressSegmentsOf(file).filter((segment) => !isParameter(segment)).length;

  return candidates.sort(
    (first, second) => fixedSegmentCount(second) - fixedSegmentCount(first),
  )[0];
}

describe("the recipe addresses and the screens under app/", () => {
  it("should open a screen at the library's address", () => {
    expect(routeFileFor(recipesPath())).toBeDefined();
  });

  it("should open the archived recipes inside the Recipes tab", () => {
    expect(routeFileFor(archivedRecipesPath())).toBe("(tabs)/recipes/archived.tsx");
  });

  it("should open the new recipe editor, with or without a typed name", () => {
    expect(routeFileFor(newRecipePath())).toBe("recipes/new.tsx");
    expect(routeFileFor(newRecipePath("pasta"))).toBe("recipes/new.tsx");
  });

  it("should open the recipe view at a recipe's address", () => {
    expect(routeFileFor(recipePath(SOME_RECIPE_ID))).toBe("recipes/[id]/index.tsx");
  });

  it("should open the editor of a saved recipe at its edit address", () => {
    expect(routeFileFor(editRecipePath(SOME_RECIPE_ID))).toBe("recipes/[id]/edit.tsx");
  });

  it("should open the refresh of a saved recipe's ingredients at its refresh address", () => {
    expect(routeFileFor(refreshRecipePath(SOME_RECIPE_ID))).toBe("recipes/[id]/refresh.tsx");
  });

  it("should open the amount step of a recipe at its log address, in the foods sheet", () => {
    expect(routeFileFor(logRecipePath(SOME_RECIPE_ID))).toBe("foods/recipe/[id]/log.tsx");
  });

  it("should open no screen at an address nothing is built for", () => {
    expect(routeFileFor("/recipes/archived/surprise")).toBeUndefined();
  });
});
