// Exports the approved canvas boards into docs/design: a PNG and a standalone HTML page per board,
// the verbatim canvas source, the design system snapshot and a README per screen.
//
//   pnpm --filter @keylow/design-export export --canvas <design-canvas folder> \
//     --design-source <design-source folder> --runtime <dc-runtime.js>
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { chromium } from "playwright";

import { relativeAssetUrls } from "./assets.ts";
import { listBoards, listScreens, parseCanvas, sectionsOf } from "./boards.ts";
import { startBoardServer } from "./boardServer.ts";
import { countFrames, readPageTitle } from "./boardSource.ts";
import { checkBoards } from "./checkBoards.ts";
import { renderBoard } from "./renderBoard.ts";
import { mergeScreenReadme } from "./screenReadme.ts";
import { buildStaticPage, findPageProblems, rewriteAssetUrls } from "./staticPage.ts";

import type { Board } from "./boards.ts";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const renderConcurrency = 4;

const { values } = parseArgs({
  options: {
    canvas: { type: "string" },
    "design-source": { type: "string" },
    runtime: { type: "string" },
    out: { type: "string", default: join(repositoryRoot, "docs/design") },
    only: { type: "string" },
  },
});

function requireOption(name: "canvas" | "design-source" | "runtime"): string {
  const value = values[name];
  if (value === undefined) {
    console.error(
      "Usage: export --canvas <design-canvas folder> --design-source <design-source folder> --runtime <dc-runtime.js> [--out <folder>] [--only <screen slug or board file>]",
    );
    process.exit(2);
  }
  return resolve(value);
}

const canvasDirectory = requireOption("canvas");
const designSourceDirectory = requireOption("design-source");
const runtimePath = requireOption("runtime");
const outputDirectory = resolve(values.out);
const only = values.only;

// The canvas files are copied byte for byte. Nothing in them is edited.
function copySource(): void {
  rmSync(join(outputDirectory, "source"), { recursive: true, force: true });
  mkdirSync(join(outputDirectory, "source/project"), { recursive: true });
  mkdirSync(join(outputDirectory, "source/brand"), { recursive: true });
  mkdirSync(join(outputDirectory, "tokens"), { recursive: true });
  for (const file of readdirSync(join(canvasDirectory, "project"))) {
    if (file.endsWith(".dc.html") || file === "canvas.json") {
      cpSync(join(canvasDirectory, "project", file), join(outputDirectory, "source/project", file));
    }
  }
  for (const file of readdirSync(join(canvasDirectory, "brand"))) {
    if (file.endsWith(".svg")) {
      cpSync(join(canvasDirectory, "brand", file), join(outputDirectory, "source/brand", file));
    }
  }
  cpSync(
    join(canvasDirectory, "tokens/kilo-tokens.css"),
    join(outputDirectory, "tokens/kilo-tokens.css"),
  );
  rmSync(join(outputDirectory, "design-system"), { recursive: true, force: true });
  cpSync(designSourceDirectory, join(outputDirectory, "design-system"), { recursive: true });
}

function readBoardSource(board: Board): string {
  return readFileSync(join(outputDirectory, "source/project", board.fileName), "utf8");
}

async function renderAll(boards: readonly Board[], origin: string): Promise<void> {
  const browser = await chromium.launch();
  try {
    const queue = [...boards];
    const worker = async (): Promise<void> => {
      for (let board = queue.shift(); board !== undefined; board = queue.shift()) {
        const source = readBoardSource(board);
        const rendered = await renderBoard(browser, origin, board, countFrames(source));
        const page = buildStaticPage({
          lang: rendered.lang,
          title: readPageTitle(source),
          tokensHref: "../tokens/kilo-tokens.css",
          fontsHref: rendered.fontsHref,
          styles: rendered.styles,
          boardHtml: rewriteAssetUrls(rendered.boardHtml, relativeAssetUrls()),
        });
        const problems = findPageProblems(page);
        if (problems.length > 0) {
          throw new Error(`${board.slug}/${board.state}: ${problems.join(", ")}`);
        }
        const folder = join(outputDirectory, board.slug);
        mkdirSync(folder, { recursive: true });
        writeFileSync(join(folder, `${board.state}.png`), rendered.png);
        writeFileSync(join(folder, `${board.state}.html`), page);
        console.log(`exported ${board.slug}/${board.state}`);
      }
    };
    await Promise.all(Array.from({ length: renderConcurrency }, worker));
  } finally {
    await browser.close();
  }
}

function writeScreenReadmes(boards: readonly Board[]): void {
  const canvas = parseCanvas(
    JSON.parse(readFileSync(join(outputDirectory, "source/project/canvas.json"), "utf8")),
  );
  const sections = sectionsOf(canvas, boards);
  for (const slug of listScreens(boards)) {
    const screenBoards = boards.filter((board) => board.slug === slug);
    const path = join(outputDirectory, slug, "README.md");
    const existing = existsSync(path) ? readFileSync(path, "utf8") : undefined;
    const section = sections.get(slug);
    const readme = mergeScreenReadme(existing, {
      slug,
      heading: section?.heading ?? slug,
      boards: screenBoards,
      pageTitles: new Map(
        screenBoards.map((board) => [board.fileName, readPageTitle(readBoardSource(board))]),
      ),
      notes: section?.notes ?? [],
    });
    mkdirSync(join(outputDirectory, slug), { recursive: true });
    writeFileSync(path, readme);
  }
}

function removeStaleBoardFiles(boards: readonly Board[]): void {
  const keep = new Set(
    boards.flatMap((board) => [
      `${board.slug}/${board.state}.png`,
      `${board.slug}/${board.state}.html`,
    ]),
  );
  for (const slug of listScreens(boards)) {
    for (const file of readdirSync(join(outputDirectory, slug))) {
      if (/\.(?:png|html)$/.test(file) && !keep.has(`${slug}/${file}`)) {
        rmSync(join(outputDirectory, slug, file));
      }
    }
  }
}

copySource();
const canvas = parseCanvas(
  JSON.parse(readFileSync(join(outputDirectory, "source/project/canvas.json"), "utf8")),
);
const allBoards = listBoards(canvas);
const selected = allBoards.filter(
  (board) => only === undefined || board.slug === only || board.fileName === only,
);
if (selected.length === 0) {
  console.error(`No board matches --only ${only ?? ""}`);
  process.exit(2);
}

const server = await startBoardServer({ designDirectory: outputDirectory, runtimePath });
try {
  await renderAll(selected, server.origin);
} finally {
  await server.close();
}
writeScreenReadmes(allBoards);
if (only === undefined) {
  removeStaleBoardFiles(allBoards);
}
const check = checkBoards(outputDirectory);
console.log(
  `${check.boardCount} boards in ${check.screenCount} screens. Missing: ${check.missing.length}. Extra: ${check.extra.length}.`,
);
if (only === undefined && (check.missing.length > 0 || check.extra.length > 0)) {
  process.exit(1);
}
