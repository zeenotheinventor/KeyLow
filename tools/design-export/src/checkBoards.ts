// Compares the exported files on disk with the boards that canvas.json lists, one for one.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { listBoards, listScreens, parseCanvas } from "./boards.ts";
import { m2CanvasSet } from "./canvasSets.ts";

import type { Canvas } from "./boards.ts";
import type { CanvasSet } from "./canvasSets.ts";

export type BoardCheck = {
  boardCount: number;
  screenCount: number;
  missing: string[];
  extra: string[];
};

// Folders under docs/design that hold no screen, besides each canvas source folder.
const nonScreenFolders = ["design-system", "tokens"];
const exportedBoardFile = /\.(?:png|html)$/;

function listScreenFiles(designDirectory: string, nonScreenEntries: ReadonlySet<string>): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(designDirectory)) {
    const path = join(designDirectory, entry);
    if (nonScreenEntries.has(entry) || !statSync(path).isDirectory()) {
      continue;
    }
    for (const file of readdirSync(path)) {
      if (exportedBoardFile.test(file) || file === "README.md") {
        files.push(`${entry}/${file}`);
      }
    }
  }
  return files;
}

function listSourceFiles(designDirectory: string, set: CanvasSet): string[] {
  return readdirSync(join(designDirectory, set.sourceFolder, "project"))
    .filter((file) => file.endsWith(".dc.html"))
    .map((file) => `${set.sourceFolder}/project/${file}`);
}

function readCanvas(designDirectory: string, set: CanvasSet): Canvas {
  return parseCanvas(
    JSON.parse(
      readFileSync(join(designDirectory, set.sourceFolder, "project/canvas.json"), "utf8"),
    ),
  );
}

// The default is the M2 canvas alone. The command line and the committed-output test pass every set.
export function checkBoards(
  designDirectory: string,
  sets: readonly CanvasSet[] = [m2CanvasSet],
): BoardCheck {
  const nonScreenEntries = new Set([...nonScreenFolders, ...sets.map((set) => set.sourceFolder)]);
  const canvases = sets.map((set) => ({ set, canvas: readCanvas(designDirectory, set) }));
  const boards = canvases.flatMap(({ set, canvas }) => listBoards(canvas, set.boardNames));
  const screens = listScreens(boards);
  const expected = [
    ...boards.flatMap((board) => [
      `${board.slug}/${board.state}.png`,
      `${board.slug}/${board.state}.html`,
    ]),
    ...screens.map((slug) => `${slug}/README.md`),
  ];
  const expectedSource = canvases.flatMap(({ set, canvas }) =>
    canvas.order.map((fileName) => `${set.sourceFolder}/project/${fileName}`),
  );
  const missing = [...expected, ...expectedSource].filter(
    (path) => !existsSync(join(designDirectory, path)),
  );
  const expectedPaths = new Set([...expected, ...expectedSource]);
  const extra = [
    ...listScreenFiles(designDirectory, nonScreenEntries),
    ...sets.flatMap((set) => listSourceFiles(designDirectory, set)),
  ].filter((path) => !expectedPaths.has(path));
  return { boardCount: boards.length, screenCount: screens.length, missing, extra };
}
