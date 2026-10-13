// Proves the static pages match their PNGs. Each page is opened from disk (file://) at the board's
// size, screenshotted and compared with the committed PNG. A page also fails when it asks for
// anything other than its own files and Google Fonts.
//
//   pnpm --filter @keylow/design-export verify [--design <docs/design folder>] [--report <file>] [--only <screen slug>]
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { chromium } from "playwright";

import { listBoards, parseCanvas } from "./boards.ts";
import { differingPixelPercent } from "./diff.ts";
import { deviceScaleFactor } from "./renderBoard.ts";
import { isAllowedRequestUrl } from "./staticPage.ts";

import type { Board } from "./boards.ts";

// The limit set by the export ticket.
const maximumDifferingPercent = 0.5;
const verifyConcurrency = 4;

type BoardResult = {
  name: string;
  differingPercent: number;
  refusedRequests: string[];
};

const { values } = parseArgs({
  options: {
    design: { type: "string", default: resolve(import.meta.dirname, "../../../docs/design") },
    report: { type: "string" },
    only: { type: "string" },
  },
});
const designDirectory = resolve(values.design);
const only = values.only;

async function verifyBoard(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  board: Board,
): Promise<BoardResult> {
  const name = `${board.slug}/${board.state}`;
  const context = await browser.newContext({
    viewport: { width: board.width, height: board.height },
    deviceScaleFactor,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    const refusedRequests: string[] = [];
    page.on("request", (request) => {
      if (!isAllowedRequestUrl(request.url())) {
        refusedRequests.push(request.url());
      }
    });
    await page.goto(pathToFileURL(join(designDirectory, `${name}.html`)).href, {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => document.fonts.ready);
    const actual = await page.screenshot({
      clip: { x: 0, y: 0, width: board.width, height: board.height },
      animations: "disabled",
    });
    const expected = readFileSync(join(designDirectory, `${name}.png`));
    return { name, differingPercent: differingPixelPercent(expected, actual), refusedRequests };
  } finally {
    await context.close();
  }
}

function renderReport(results: readonly BoardResult[]): string {
  const rows = results.map(
    (result) =>
      `| ${result.name} | ${result.differingPercent.toFixed(4)} | ${result.refusedRequests.length} |`,
  );
  return ["| Board | Differing pixels (%) | Refused requests |", "|---|---|---|", ...rows, ""].join(
    "\n",
  );
}

const canvas = parseCanvas(
  JSON.parse(readFileSync(join(designDirectory, "source/project/canvas.json"), "utf8")),
);
const boards = listBoards(canvas).filter(
  (board) => only === undefined || board.slug === only || `${board.slug}/${board.state}` === only,
);
const browser = await chromium.launch();
const results: BoardResult[] = [];
try {
  const queue = [...boards];
  const worker = async (): Promise<void> => {
    for (let board = queue.shift(); board !== undefined; board = queue.shift()) {
      results.push(await verifyBoard(browser, board));
    }
  };
  await Promise.all(Array.from({ length: verifyConcurrency }, worker));
} finally {
  await browser.close();
}

results.sort((first, second) => second.differingPercent - first.differingPercent);
const failures = results.filter(
  (result) =>
    result.differingPercent >= maximumDifferingPercent || result.refusedRequests.length > 0,
);
console.log(`Checked ${results.length} boards. Worst differences:`);
for (const result of results.slice(0, 10)) {
  console.log(`  ${result.differingPercent.toFixed(4)} %  ${result.name}`);
}
for (const failure of failures) {
  console.log(
    `FAIL ${failure.name}: ${failure.differingPercent.toFixed(4)} %, refused: ${failure.refusedRequests.join(" ")}`,
  );
}
if (values.report !== undefined) {
  writeFileSync(
    values.report,
    renderReport([...results].sort((first, second) => first.name.localeCompare(second.name))),
  );
}
console.log(
  failures.length === 0 ? `All under ${maximumDifferingPercent} %.` : `${failures.length} failed.`,
);
process.exit(failures.length === 0 ? 0 : 1);
