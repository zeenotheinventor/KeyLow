import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseBlobMap } from "../src/assets.ts";
import { startBoardServer } from "../src/boardServer.ts";

import type { BoardServer } from "../src/boardServer.ts";

const canvasAssets = parseBlobMap({
  "/_blob/tokens": "tokens/kilo-tokens.css",
  "/_blob/mark": "brand/mark.svg",
});

let directory = "";
let server: BoardServer | undefined;

function write(relativePath: string, content: string): void {
  const target = join(directory, relativePath);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, content);
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "design-export-server-"));
  write("source-m3/project/Main.dc.html", "<x-dc>board</x-dc>");
  write("source-m3/tokens/kilo-tokens.css", ":root{}");
  write("source-m3/brand/mark.svg", "<svg/>");
  write("runtime.js", "window.runtime = true;");
  write("secret.txt", "secret");
});

afterEach(async () => {
  await server?.close();
  server = undefined;
  rmSync(directory, { recursive: true, force: true });
});

async function fetchText(
  path: string,
): Promise<{ status: number; type: string | null; body: string }> {
  const response = await fetch(`${server?.origin ?? ""}${path}`);
  return {
    status: response.status,
    type: response.headers.get("content-type"),
    body: await response.text(),
  };
}

describe("startBoardServer", () => {
  async function start(port?: number): Promise<void> {
    server = await startBoardServer({
      designDirectory: directory,
      sourceFolder: "source-m3",
      assets: canvasAssets,
      runtimePath: join(directory, "runtime.js"),
      port,
    });
  }

  it("should serve the runtime file under the name the boards load", async () => {
    await start();
    expect(await fetchText("/support.js")).toMatchObject({
      status: 200,
      body: "window.runtime = true;",
    });
  });

  it("should serve a board file from the project folder", async () => {
    await start();
    expect(await fetchText("/Main.dc.html")).toMatchObject({
      status: 200,
      body: "<x-dc>board</x-dc>",
    });
  });

  it("should map the blob URL of the canvas token stylesheet to the committed canvas copy", async () => {
    await start();
    const stylesheet = canvasAssets.find((asset) => asset.file === "tokens/kilo-tokens.css");
    const response = await fetchText(stylesheet?.blob ?? "/missing");
    expect(response).toMatchObject({ status: 200, body: ":root{}" });
    expect(response.type).toContain("text/css");
  });

  it("should map the blob URL of a brand mark with an SVG type", async () => {
    await start();
    const mark = canvasAssets.find((asset) => asset.file === "brand/mark.svg");
    expect((await fetchText(mark?.blob ?? "/missing")).type).toContain("image/svg+xml");
  });

  it("should listen on the port it is given", async () => {
    await start();
    const freePort = Number(new URL(server?.origin ?? "").port);
    await server?.close();
    await start(freePort);
    expect(server?.origin).toBe(`http://127.0.0.1:${freePort}`);
  });

  it("should answer 404 for an unknown blob", async () => {
    await start();
    expect((await fetchText("/_blob/unknown")).status).toBe(404);
  });

  it("should not serve a file outside the project folder", async () => {
    await start();
    expect((await fetchText("/..%2F..%2Fsecret.txt")).status).toBe(404);
  });
});
