// A canvas is exported under docs/design/source, and each later canvas under its own source folder
// (source-m3, ...). The boards of every canvas live side by side as docs/design/<screen>/<state>.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { listBoards, parseCanvas } from "./boards.ts";

import type { Board, Canvas } from "./boards.ts";

export const sourceFolderPattern = /^source(?:-[a-z0-9]+)?$/;

// The name is joined onto the output folder and then deleted and rewritten, so only a plain
// source folder name may pass: never ".", "..", a path, or a folder that is not a canvas source.
export function assertSourceFolderName(name: string): void {
  if (!sourceFolderPattern.test(name)) {
    throw new Error(
      `"${name}" is not a source folder name. Use "source" or "source-<name>", such as source-m3.`,
    );
  }
}

// An export replaces one source folder and cleans up the files of its screens, so it must not
// reach into another canvas. A screen belongs to one canvas, and a source folder holds one canvas.
export function assertCanvasFitsDesign(
  existing: readonly Board[],
  incoming: readonly Board[],
  sourceFolder: string,
): void {
  const incomingSlugs = new Set(incoming.map((board) => board.slug));
  for (const board of existing) {
    if (board.sourceFolder !== sourceFolder && incomingSlugs.has(board.slug)) {
      throw new Error(
        `The screen ${board.slug} already belongs to ${board.sourceFolder}, so ${sourceFolder} cannot export boards for it`,
      );
    }
  }
  const owned = existing.filter((board) => board.sourceFolder === sourceFolder);
  if (owned.length > 0 && !owned.some((board) => incomingSlugs.has(board.slug))) {
    throw new Error(
      `${sourceFolder} holds a different canvas: none of its screens is in the canvas being exported`,
    );
  }
}

export function listCanvasSources(designDirectory: string): string[] {
  if (!existsSync(designDirectory)) {
    return [];
  }
  return readdirSync(designDirectory)
    .filter(
      (entry) =>
        sourceFolderPattern.test(entry) &&
        existsSync(join(designDirectory, entry, "project/canvas.json")),
    )
    .sort();
}

export function readCanvas(designDirectory: string, sourceFolder: string): Canvas {
  return parseCanvas(
    JSON.parse(readFileSync(join(designDirectory, sourceFolder, "project/canvas.json"), "utf8")),
  );
}

export function readAllBoards(designDirectory: string): Board[] {
  const boards = listCanvasSources(designDirectory).flatMap((sourceFolder) =>
    listBoards(readCanvas(designDirectory, sourceFolder), sourceFolder),
  );
  const seen = new Map<string, string>();
  for (const board of boards) {
    const name = `${board.slug}/${board.state}`;
    const firstSource = seen.get(name);
    if (firstSource !== undefined) {
      throw new Error(`${name} is a board of both ${firstSource} and ${board.sourceFolder}`);
    }
    seen.set(name, board.sourceFolder);
  }
  return boards;
}
