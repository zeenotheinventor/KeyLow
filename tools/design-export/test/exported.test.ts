// Checks the committed export in docs/design against the canvas that produced it. No browser is
// needed. The pixel comparison with a browser is the verify script.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { listBoards, parseCanvas } from "../src/boards.ts";
import { checkBoards } from "../src/checkBoards.ts";
import { extractProposals } from "../src/proposals.ts";
import { deviceScaleFactor } from "../src/renderBoard.ts";
import { findPageProblems } from "../src/staticPage.ts";

const designDirectory = resolve(import.meta.dirname, "../../../docs/design");
const repositoryRoot = resolve(import.meta.dirname, "../../..");
const canvas = parseCanvas(
  JSON.parse(readFileSync(join(designDirectory, "source/project/canvas.json"), "utf8")),
);
const boards = listBoards(canvas);

// These two boards are the Ki-Lo mark on a plain background, with a line of text on the second.
// They use no design system component.
const boardsWithoutComponents = new Set(["tab-shell/session-loading", "auth/signing-in-link"]);

function pngSize(path: string): { width: number; height: number } {
  const header = readFileSync(path).subarray(0, 24);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function listFilesBelow(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listFilesBelow(path) : [path];
  });
}

describe("the committed design export", () => {
  it("should have a PNG, an HTML page and a README for every board in canvas.json and nothing else", () => {
    expect(checkBoards(designDirectory)).toEqual({
      boardCount: 115,
      screenCount: 9,
      missing: [],
      extra: [],
    });
  });

  it.each(boards.map((board) => [`${board.slug}/${board.state}`, board] as const))(
    "%s should be a PNG of the board size at the export scale",
    (name, board) => {
      expect(pngSize(join(designDirectory, `${name}.png`))).toEqual({
        width: board.width * deviceScaleFactor,
        height: board.height * deviceScaleFactor,
      });
    },
  );

  it.each(boards.map((board) => `${board.slug}/${board.state}`))(
    "%s should be a static page with tokens and no runtime or network trace",
    (name) => {
      const html = readFileSync(join(designDirectory, `${name}.html`), "utf8");
      expect(findPageProblems(html)).toEqual([]);
      expect(html.includes("data-kilo=")).toBe(!boardsWithoutComponents.has(name));
    },
  );

  it.each(boards.map((board) => [`${board.slug}/${board.state}`, board] as const))(
    "%s should be listed in its screen README with its image",
    (_name, board) => {
      const readme = readFileSync(join(designDirectory, board.slug, "README.md"), "utf8");
      expect(readme).toContain(`![${board.slug} ${board.state}](${board.state}.png)`);
      expect(readme).toContain(`[${board.state}.html](${board.state}.html)`);
    },
  );

  it("should link the packages/tokens stylesheet that exists, from every page", () => {
    const stylesheet = join(repositoryRoot, "packages/tokens/css/kilo-tokens.css");
    expect(existsSync(stylesheet)).toBe(true);
    for (const board of boards) {
      const folder = join(designDirectory, board.slug);
      const html = readFileSync(join(folder, `${board.state}.html`), "utf8");
      expect(html).toContain(
        '<link rel="stylesheet" href="../../../packages/tokens/css/kilo-tokens.css">\n<link rel="stylesheet" href="../tokens/kilo-proposals.css">',
      );
      expect(resolve(folder, "../../../packages/tokens/css/kilo-tokens.css")).toBe(stylesheet);
    }
  });

  it("should keep the proposals stylesheet equal to the marked block of the canvas token file", () => {
    const canvasTokens = readFileSync(
      join(designDirectory, "source/tokens/kilo-tokens.css"),
      "utf8",
    );
    expect(readFileSync(join(designDirectory, "tokens/kilo-proposals.css"), "utf8")).toBe(
      extractProposals(canvasTokens),
    );
  });

  it("should propose no custom property that packages/tokens already defines", () => {
    const proposals = readFileSync(join(designDirectory, "tokens/kilo-proposals.css"), "utf8");
    const tokens = readFileSync(
      join(repositoryRoot, "packages/tokens/css/kilo-tokens.css"),
      "utf8",
    );
    const proposed = [...proposals.matchAll(/(?:^|[{;\s])(--[a-z0-9-]+):/g)].map(
      (match) => match[1],
    );
    expect(proposed.length).toBeGreaterThan(0);
    for (const name of proposed) {
      expect(tokens).not.toContain(`${name}:`);
    }
  });

  it("should no longer hold the retired docs/design copy of the token stylesheet", () => {
    expect(existsSync(join(designDirectory, "tokens/kilo-tokens.css"))).toBe(false);
  });

  it("should carry no claude.ai URL in any text file", () => {
    const textFiles = listFilesBelow(designDirectory).filter((path) =>
      /\.(?:html|md|json|css|svg|js|jsx|ts)$/.test(path),
    );
    const offenders = textFiles.filter((path) => readFileSync(path, "utf8").includes("claude.ai"));
    expect(offenders).toEqual([]);
  });

  it("should not hold the canvas runtime", () => {
    const names = [
      ...listFilesBelow(designDirectory),
      ...listFilesBelow(join(repositoryRoot, "tools/design-export")),
    ]
      .filter((path) => !path.includes("node_modules"))
      .map((path) => path.split("/").pop());
    expect(names).not.toContain("dc-runtime.js");
    expect(names).not.toContain("support.js");
    expect(existsSync(join(designDirectory, "source/project/support.js"))).toBe(false);
  });
});
