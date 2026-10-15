// Compares the exported files on disk with the boards that canvas.json lists, one for one.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { listScreens } from "./boards.ts";
import { listCanvasSources, readAllBoards, readCanvas } from "./canvasSources.ts";

export type BoardCheck = {
  boardCount: number;
  screenCount: number;
  missing: string[];
  extra: string[];
};

// Folders under docs/design that hold no screen, besides the canvas source folders.
const nonScreenEntries = new Set(["design-system", "tokens"]);
const exportedBoardFile = /\.(?:png|html)$/;

function listScreenFiles(designDirectory: string, sources: readonly string[]): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(designDirectory)) {
    const path = join(designDirectory, entry);
    if (nonScreenEntries.has(entry) || sources.includes(entry) || !statSync(path).isDirectory()) {
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

function listSourceFiles(designDirectory: string, sources: readonly string[]): string[] {
  return sources.flatMap((source) =>
    readdirSync(join(designDirectory, source, "project"))
      .filter((file) => file.endsWith(".dc.html"))
      .map((file) => `${source}/project/${file}`),
  );
}

export function checkBoards(designDirectory: string): BoardCheck {
  const sources = listCanvasSources(designDirectory);
  const boards = readAllBoards(designDirectory);
  const screens = listScreens(boards);
  const expected = [
    ...boards.flatMap((board) => [
      `${board.slug}/${board.state}.png`,
      `${board.slug}/${board.state}.html`,
    ]),
    ...screens.map((slug) => `${slug}/README.md`),
  ];
  const expectedSource = sources.flatMap((source) =>
    readCanvas(designDirectory, source).order.map((fileName) => `${source}/project/${fileName}`),
  );
  const missing = [...expected, ...expectedSource].filter(
    (path) => !existsSync(join(designDirectory, path)),
  );
  const expectedPaths = new Set([...expected, ...expectedSource]);
  const extra = [
    ...listScreenFiles(designDirectory, sources),
    ...listSourceFiles(designDirectory, sources),
  ].filter((path) => !expectedPaths.has(path));
  return { boardCount: boards.length, screenCount: screens.length, missing, extra };
}
