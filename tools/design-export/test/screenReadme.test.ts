import { describe, expect, it } from "vitest";

import { boardsEnd, boardsStart, mergeScreenReadme } from "../src/screenReadme.ts";

import type { Board } from "../src/boards.ts";
import type { ScreenReadmeInput } from "../src/screenReadme.ts";

const board = (state: string, fileName: string, sourceFolder = "source"): Board => ({
  sourceFolder,
  fileName,
  slug: "food-search",
  state,
  layout: "mobile",
  width: 820,
  height: 844,
  x: 0,
  y: 0,
  canvasTitle: `food-search · ${state}`,
});

const input: ScreenReadmeInput = {
  slug: "food-search",
  heading: "Find food sheet",
  boards: [board("idle", "Main.dc.html"), board("loading", "food-search.loading.dc.html")],
  pageTitles: new Map([
    ["Main.dc.html", "Find food, idle"],
    ["food-search.loading.dc.html", "Find food, loading"],
  ]),
  notes: ["Copy decision\nsecond line"],
};

describe("mergeScreenReadme", () => {
  it("should start a new README with the screen name and its canvas heading", () => {
    const readme = mergeScreenReadme(undefined, input);
    expect(readme.startsWith("# food-search\n\nFind food sheet\n")).toBe(true);
  });

  it("should list each board in order with its image, title, HTML link and source", () => {
    const readme = mergeScreenReadme(undefined, input);
    expect(readme.indexOf("### idle")).toBeLessThan(readme.indexOf("### loading"));
    expect(readme).toContain("![food-search idle](idle.png)");
    expect(readme).toContain("Find food, idle");
    expect(readme).toContain("[idle.html](idle.html)");
    expect(readme).toContain("[Main.dc.html](../source/project/Main.dc.html)");
  });

  it("should link the source of a board under the source folder of its canvas", () => {
    const readme = mergeScreenReadme(undefined, {
      ...input,
      boards: [board("idle", "Main.dc.html", "source-m3")],
    });
    expect(readme).toContain("[Main.dc.html](../source-m3/project/Main.dc.html)");
  });

  it("should quote the canvas notes", () => {
    expect(mergeScreenReadme(undefined, input)).toContain("> Copy decision\n> second line");
  });

  it("should keep hand-written text outside the markers when it regenerates the boards", () => {
    const first = mergeScreenReadme(undefined, input);
    const edited = first.replace(/## Decisions[\s\S]*$/, "## Decisions\n\nZee ruled on it.\n");
    const second = mergeScreenReadme(edited, {
      ...input,
      boards: [board("idle", "Main.dc.html")],
    });
    expect(second).toContain("Zee ruled on it.");
    expect(second).not.toContain("### loading");
    expect(second.match(new RegExp(boardsStart, "g"))).toHaveLength(1);
    expect(second.match(new RegExp(boardsEnd, "g"))).toHaveLength(1);
  });

  it("should give the same text when run twice", () => {
    const first = mergeScreenReadme(undefined, input);
    expect(mergeScreenReadme(first, input)).toBe(first);
  });
});
