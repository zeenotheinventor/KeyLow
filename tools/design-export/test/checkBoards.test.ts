import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { canvasSets, m2CanvasSet } from "../src/canvasSets.ts";
import { checkBoards } from "../src/checkBoards.ts";

import type { CanvasSet } from "../src/canvasSets.ts";

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

function writeWidgetsExport(
  canvasFiles: readonly string[],
  exportedStates: readonly string[],
): void {
  const board = (index: number) => ({ x: index * 1360, y: 0, w: 1280, h: 980, title: `t${index}` });
  write(
    "source-widgets/project/canvas.json",
    JSON.stringify({
      order: canvasFiles,
      boards: Object.fromEntries(canvasFiles.map((file, index) => [file, board(index)])),
      notes: {},
    }),
  );
  for (const file of canvasFiles) {
    write(`source-widgets/project/${file}`);
  }
  for (const state of exportedStates) {
    write(`widgets/${state}.png`);
    write(`widgets/${state}.html`);
  }
  write("widgets/README.md");
}

describe("checkBoards with the real widgets canvas set", () => {
  const files = ["Main.dc.html", "QuickLog.dc.html", "LockScreen.dc.html", "States.dc.html"];
  const states = ["dashboard", "quick-log", "lock-screen", "states"];

  it("should count all four widget boards with the M2 boards and report nothing", () => {
    writeCompleteExport();
    writeWidgetsExport(files, states);
    expect(checkBoards(directory, canvasSets)).toEqual({
      boardCount: 6,
      screenCount: 2,
      missing: [],
      extra: [],
    });
  });

  it("should list the states image when it is missing", () => {
    writeCompleteExport();
    writeWidgetsExport(files, states);
    rmSync(join(directory, "widgets/states.png"));
    expect(checkBoards(directory, canvasSets).missing).toEqual(["widgets/states.png"]);
  });

  it("should not take the widgets source folder for a screen", () => {
    writeCompleteExport();
    writeWidgetsExport(files, states);
    expect(checkBoards(directory, canvasSets).extra).toEqual([]);
  });
});

describe("checkBoards with a canvas set whose names leave a board out", () => {
  const files = ["Main.dc.html", "QuickLog.dc.html", "Spare.dc.html"];
  const setWithSpareLeftOut: CanvasSet = {
    sourceFolder: "source-widgets",
    boardNames: {
      "Main.dc.html": { slug: "widgets", state: "dashboard" },
      "QuickLog.dc.html": { slug: "widgets", state: "quick-log" },
    },
    linksTokens: false,
  };
  const sets = [m2CanvasSet, setWithSpareLeftOut];

  function writeExport(): void {
    writeCompleteExport();
    writeWidgetsExport(files, ["dashboard", "quick-log"]);
  }

  it("should not count the board the names omit", () => {
    writeExport();
    expect(checkBoards(directory, sets)).toEqual({
      boardCount: 4,
      screenCount: 2,
      missing: [],
      extra: [],
    });
  });

  it("should list a widgets image that is missing", () => {
    writeExport();
    rmSync(join(directory, "widgets/quick-log.png"));
    expect(checkBoards(directory, sets).missing).toEqual(["widgets/quick-log.png"]);
  });

  it("should still require the verbatim source of the board the names omit", () => {
    writeExport();
    rmSync(join(directory, "source-widgets/project/Spare.dc.html"));
    expect(checkBoards(directory, sets).missing).toEqual(["source-widgets/project/Spare.dc.html"]);
  });

  it("should list an exported image for the board the names omit", () => {
    writeExport();
    write("widgets/spare.png");
    expect(checkBoards(directory, sets).extra).toEqual(["widgets/spare.png"]);
  });
});
