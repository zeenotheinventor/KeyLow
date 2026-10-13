import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { checkBoards } from "../src/checkBoards.ts";

const canvas = {
  order: ["Main.dc.html", "food-search.loading.dc.html", "FoodSearchScreen.dc.html"],
  boards: {
    "Main.dc.html": { x: 0, y: 0, w: 820, h: 844, title: "a" },
    "food-search.loading.dc.html": { x: 900, y: 0, w: 820, h: 844, title: "b" },
    "FoodSearchScreen.dc.html": { x: 0, y: 900, w: 390, h: 844, title: "c" },
  },
  notes: {},
};

let directory = "";

function write(relativePath: string, content = "x"): void {
  const target = join(directory, relativePath);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, content);
}

function writeCompleteExport(): void {
  write("source/project/canvas.json", JSON.stringify(canvas));
  for (const file of canvas.order) {
    write(`source/project/${file}`);
  }
  for (const state of ["idle", "loading"]) {
    write(`food-search/${state}.png`);
    write(`food-search/${state}.html`);
  }
  write("food-search/README.md");
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "design-export-check-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("checkBoards", () => {
  it("should report nothing for a complete export", () => {
    writeCompleteExport();
    expect(checkBoards(directory)).toEqual({
      boardCount: 2,
      screenCount: 1,
      missing: [],
      extra: [],
    });
  });

  it("should list a board whose PNG is missing", () => {
    writeCompleteExport();
    rmSync(join(directory, "food-search/loading.png"));
    expect(checkBoards(directory).missing).toEqual(["food-search/loading.png"]);
  });

  it("should list a board whose HTML is missing", () => {
    writeCompleteExport();
    rmSync(join(directory, "food-search/idle.html"));
    expect(checkBoards(directory).missing).toEqual(["food-search/idle.html"]);
  });

  it("should list a missing screen README", () => {
    writeCompleteExport();
    rmSync(join(directory, "food-search/README.md"));
    expect(checkBoards(directory).missing).toEqual(["food-search/README.md"]);
  });

  it("should list a source board file that is missing", () => {
    writeCompleteExport();
    rmSync(join(directory, "source/project/FoodSearchScreen.dc.html"));
    expect(checkBoards(directory).missing).toEqual(["source/project/FoodSearchScreen.dc.html"]);
  });

  it("should list an image the canvas has no board for", () => {
    writeCompleteExport();
    write("food-search/removed-state.png");
    expect(checkBoards(directory).extra).toEqual(["food-search/removed-state.png"]);
  });

  it("should list a source board file the canvas does not list", () => {
    writeCompleteExport();
    write("source/project/old.state.dc.html");
    expect(checkBoards(directory).extra).toEqual(["source/project/old.state.dc.html"]);
  });

  it("should list a screen folder the canvas has no boards for", () => {
    writeCompleteExport();
    write("old-screen/idle.png");
    expect(checkBoards(directory).extra).toEqual(["old-screen/idle.png"]);
  });

  it("should ignore the folders that hold no boards", () => {
    writeCompleteExport();
    write("design-system/readme.md");
    write("tokens/kilo-tokens.css");
    write("README.md");
    expect(checkBoards(directory)).toMatchObject({ missing: [], extra: [] });
  });
});
