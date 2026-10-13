import { describe, expect, it } from "vitest";

import { listBoards, listScreens, parseCanvas, sectionsOf } from "../src/boards.ts";

const board = (x: number, y: number, w = 820, h = 844) => ({ x, y, w, h, title: `t ${x} ${y}` });

const canvasJson = {
  order: [
    "Main.dc.html",
    "food-search.loading.dc.html",
    "FoodSearchScreen.dc.html",
    "web.login-default.dc.html",
    "WebShellScreen.dc.html",
  ],
  boards: {
    "Main.dc.html": board(0, 0),
    "food-search.loading.dc.html": board(900, 0),
    "FoodSearchScreen.dc.html": board(0, 900, 390, 844),
    "web.login-default.dc.html": board(0, 3000, 3430, 812),
    "WebShellScreen.dc.html": board(0, 4000, 1280, 812),
  },
  notes: {
    searchTitle: { x: 0, y: -300, text: "Find food sheet", kind: "title1" },
    searchCopy: { x: 100, y: 1900, text: "Copy decision", fill: "gray" },
    webTitle: { x: 0, y: 2700, text: "Web login", kind: "title1" },
  },
};

describe("parseCanvas", () => {
  it("should reject JSON that has no board index", () => {
    expect(() => parseCanvas({ order: [] })).toThrow(/boards/);
  });

  it("should reject an ordered board that is missing from the board index", () => {
    expect(() => parseCanvas({ order: ["a.b.dc.html"], boards: {}, notes: {} })).toThrow(
      /a\.b\.dc\.html/,
    );
  });
});

describe("listBoards", () => {
  const boards = listBoards(parseCanvas(canvasJson));

  it("should name the Main board food-search idle", () => {
    expect(boards[0]).toMatchObject({
      slug: "food-search",
      state: "idle",
      fileName: "Main.dc.html",
    });
  });

  it("should split a file name into screen slug and state", () => {
    expect(boards[2]).toMatchObject({ slug: "web", state: "login-default", layout: "web" });
  });

  it("should leave the component boards out", () => {
    expect(boards.map((entry) => entry.fileName)).toEqual([
      "Main.dc.html",
      "food-search.loading.dc.html",
      "web.login-default.dc.html",
    ]);
  });

  it("should keep the canvas order and size", () => {
    expect(boards[2]).toMatchObject({ width: 3430, height: 812 });
  });

  it("should classify an 820 wide board as mobile", () => {
    expect(boards[0]?.layout).toBe("mobile");
  });
});

describe("listScreens", () => {
  it("should list each slug once in canvas order", () => {
    expect(listScreens(listBoards(parseCanvas(canvasJson)))).toEqual(["food-search", "web"]);
  });
});

describe("sectionsOf", () => {
  const canvas = parseCanvas(canvasJson);
  const sections = sectionsOf(canvas, listBoards(canvas));

  it("should take the heading of each screen from its title note", () => {
    expect(sections.get("food-search")?.heading).toBe("Find food sheet");
    expect(sections.get("web")?.heading).toBe("Web login");
  });

  it("should attach a note to the section whose title sits above it", () => {
    expect(sections.get("food-search")?.notes).toEqual(["Copy decision"]);
    expect(sections.get("web")?.notes).toEqual([]);
  });
});
