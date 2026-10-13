// Compares the exported files on disk with the boards that canvas.json lists, one for one.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { listBoards, listScreens, parseCanvas } from "./boards.ts";

export type BoardCheck = {
  boardCount: number;
  screenCount: number;
  missing: string[];
  extra: string[];
};

// Folders under docs/design that hold no screen.
const nonScreenEntries = new Set(["design-system", "tokens", "source"]);
const exportedBoardFile = /\.(?:png|html)$/;

function listScreenFiles(designDirectory: string): string[] {
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

function listSourceFiles(designDirectory: string): string[] {
  return readdirSync(join(designDirectory, "source/project"))
    .filter((file) => file.endsWith(".dc.html"))
    .map((file) => `source/project/${file}`);
}

export function checkBoards(designDirectory: string): BoardCheck {
  const canvas = parseCanvas(
    JSON.parse(readFileSync(join(designDirectory, "source/project/canvas.json"), "utf8")),
  );
  const boards = listBoards(canvas);
  const screens = listScreens(boards);
  const expected = [
    ...boards.flatMap((board) => [
      `${board.slug}/${board.state}.png`,
      `${board.slug}/${board.state}.html`,
    ]),
    ...screens.map((slug) => `${slug}/README.md`),
  ];
  const expectedSource = canvas.order.map((fileName) => `source/project/${fileName}`);
  const missing = [...expected, ...expectedSource].filter(
    (path) => !existsSync(join(designDirectory, path)),
  );
  const expectedPaths = new Set([...expected, ...expectedSource]);
  const extra = [...listScreenFiles(designDirectory), ...listSourceFiles(designDirectory)].filter(
    (path) => !expectedPaths.has(path),
  );
  return { boardCount: boards.length, screenCount: screens.length, missing, extra };
}
