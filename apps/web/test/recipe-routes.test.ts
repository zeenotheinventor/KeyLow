import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  archivedPath,
  editRecipePath,
  newRecipePath,
  recipePath,
  recipesPath,
} from "@/lib/recipeRoutes";

describe("recipeRoutes", () => {
  it("should lead to the library at /recipes", () => {
    expect(recipesPath()).toBe("/recipes");
  });

  it("should lead to the editor for a new recipe at /recipes/new", () => {
    expect(newRecipePath()).toBe("/recipes/new");
  });

  it("should carry a typed name to the new recipe as the name parameter", () => {
    expect(newRecipePath("pasta")).toBe("/recipes/new?name=pasta");
  });

  it("should encode a name so it stays one value", () => {
    expect(newRecipePath("Mac & cheese #2")).toBe("/recipes/new?name=Mac%20%26%20cheese%20%232");
  });

  it("should leave out the name parameter when the name is blank", () => {
    expect(newRecipePath("   ")).toBe("/recipes/new");
  });

  it("should lead to the editor of a saved recipe at /recipes/<id>/edit", () => {
    expect(editRecipePath("11111111-1111-4111-8111-111111111111")).toBe(
      "/recipes/11111111-1111-4111-8111-111111111111/edit",
    );
  });

  it("should lead to the archived recipes at /recipes/archived", () => {
    expect(archivedPath()).toBe("/recipes/archived");
  });

  it("should open a recipe in its view at /recipes/<id>", () => {
    expect(recipePath("11111111-1111-4111-8111-111111111111")).toBe(
      "/recipes/11111111-1111-4111-8111-111111111111",
    );
  });
});

const APP_DIRECTORY = path.join(__dirname, "../app");
const SAMPLE_RECIPE_ID = "11111111-1111-4111-8111-111111111111";

// The routes the app serves: the folders that hold a page, as their segments, without the route groups.
function servedRoutes(): string[][] {
  return readdirSync(APP_DIRECTORY, { recursive: true, encoding: "utf8" })
    .filter((file) => path.basename(file) === "page.tsx")
    .map((file) =>
      path
        .dirname(file)
        .split(path.sep)
        .filter((segment) => segment !== "." && !/^\(.+\)$/.test(segment)),
    );
}

// A dynamic segment stands for the recipe's id, so any other word has to be a folder of its own: a link to
// /recipes/new must not be satisfied by the page of a recipe whose id is "new".
function isServed(href: string): boolean {
  const segments = new URL(href, "http://localhost").pathname.split("/").filter(Boolean);

  return servedRoutes().some(
    (route) =>
      route.length === segments.length &&
      route.every(
        (segment, position) =>
          segment === segments[position] ||
          (/^\[.+\]$/.test(segment) && segments[position] === SAMPLE_RECIPE_ID),
      ),
  );
}

describe("the recipe routes in the route table", () => {
  it.each([
    ["the library", recipesPath()],
    ["the archived recipes", archivedPath()],
    ["the new recipe editor", newRecipePath()],
    ["the new recipe editor with a typed name", newRecipePath("pasta")],
    ["the recipe view", recipePath(SAMPLE_RECIPE_ID)],
    ["the editor of a saved recipe", editRecipePath(SAMPLE_RECIPE_ID)],
  ])("should have a page for %s", (_name, href) => {
    expect(isServed(href)).toBe(true);
  });

  it("should not count a link to a page that does not exist", () => {
    expect(isServed("/recipes/new/ingredients")).toBe(false);
    expect(isServed(`/recipes/${SAMPLE_RECIPE_ID}/archive`)).toBe(false);
    expect(isServed("/recipes/not-an-id")).toBe(false);
  });
});
