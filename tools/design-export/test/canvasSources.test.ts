import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertCanvasFitsDesign,
  assertSourceFolderName,
  listCanvasSources,
  readAllBoards,
} from "../src/canvasSources.ts";

import type { Board } from "../src/boards.ts";

function canvasJson(...files: string[]): string {
  return JSON.stringify({
    order: files,
    boards: Object.fromEntries(
      files.map((file) => [file, { x: 0, y: 0, w: 820, h: 844, title: "diary · today" }]),
    ),
    notes: {},
  });
}

let directory = "";

function write(relativePath: string, content: string): void {
  const target = join(directory, relativePath);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, content);
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "design-export-sources-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("listCanvasSources", () => {
  it("should find the source folder of each canvas, the first one first", () => {
    write("source-m3/project/canvas.json", canvasJson());
    write("source/project/canvas.json", canvasJson());
    write("source-m4/project/canvas.json", canvasJson());
    expect(listCanvasSources(directory)).toEqual(["source", "source-m3", "source-m4"]);
  });

  it("should list nothing for a design folder that does not exist yet", () => {
    expect(listCanvasSources(join(directory, "missing"))).toEqual([]);
  });

  it("should pin the order: source first, then the other folders by name", () => {
    write("source-m4/project/canvas.json", canvasJson());
    write("source-m10/project/canvas.json", canvasJson());
    write("source/project/canvas.json", canvasJson());
    write("source-m3/project/canvas.json", canvasJson());
    expect(listCanvasSources(directory)).toEqual([
      "source",
      "source-m10",
      "source-m3",
      "source-m4",
    ]);
  });

  it("should ignore a folder that holds no canvas.json and one that is not named source", () => {
    write("source/project/canvas.json", canvasJson());
    write("source-notes/readme.md", "x");
    write("web/project/canvas.json", canvasJson());
    expect(listCanvasSources(directory)).toEqual(["source"]);
  });
});

describe("readAllBoards", () => {
  it("should read the boards of every canvas, each tagged with its source folder", () => {
    write("source/project/canvas.json", canvasJson("Main.dc.html"));
    write("source-m3/project/canvas.json", canvasJson("diary.complete.dc.html"));
    expect(readAllBoards(directory).map((board) => [board.sourceFolder, board.slug])).toEqual([
      ["source", "diary"],
      ["source-m3", "diary"],
    ]);
  });
});

describe("assertSourceFolderName", () => {
  it.each([
    ".",
    "..",
    "../escape",
    "/etc",
    "source/../x",
    "../source",
    "x/source",
    "a-source",
    "Source",
    "source-M3",
    "design-system",
    "",
  ])("should refuse %j", (name) => {
    expect(() => {
      assertSourceFolderName(name);
    }).toThrow(/source folder/);
  });

  it.each(["source", "source-m3", "source-m10"])("should accept %s", (name) => {
    expect(() => {
      assertSourceFolderName(name);
    }).not.toThrow();
  });
});

const board = (sourceFolder: string, slug: string, state: string): Board => ({
  sourceFolder,
  fileName: `${slug}.${state}.dc.html`,
  slug,
  state,
  layout: "mobile",
  width: 820,
  height: 844,
  x: 0,
  y: 0,
  canvasTitle: `${slug} · ${state}`,
});

describe("assertCanvasFitsDesign", () => {
  const existing = [board("source", "food-search", "idle"), board("source", "auth", "sign-in")];

  it("should accept the first canvas into an empty design folder", () => {
    expect(() => {
      assertCanvasFitsDesign([], [board("source", "food-search", "idle")], "source");
    }).not.toThrow();
  });

  it("should accept a canvas with new screens into its own new source folder", () => {
    expect(() => {
      assertCanvasFitsDesign(existing, [board("source-m3", "diary", "today")], "source-m3");
    }).not.toThrow();
  });

  it("should accept a re-export of a canvas into its own folder, even with a new state", () => {
    expect(() => {
      assertCanvasFitsDesign(
        existing,
        [board("source", "food-search", "idle"), board("source", "food-search", "new-state")],
        "source",
      );
    }).not.toThrow();
  });

  it("should refuse a screen that another canvas owns, because its files would be cleaned up", () => {
    expect(() => {
      assertCanvasFitsDesign(existing, [board("source-m3", "food-search", "recent")], "source-m3");
    }).toThrow(/food-search.*source/);
  });

  it("should refuse to export a different canvas into a folder that holds another one", () => {
    expect(() => {
      assertCanvasFitsDesign(existing, [board("source", "diary", "today")], "source");
    }).toThrow(/different canvas/);
  });
});
