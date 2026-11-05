import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import {
  RECIPE_PAGE_HOST,
  RECIPE_PAGE_SERVER_PORT,
  recipePageUrl,
  startPageServer,
} from "../src/pageServer.ts";

import type { PageServer } from "../src/pageServer.ts";

// Port 0 asks the system for a free port, so these tests never meet the fixed one.
const servers: PageServer[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function started(pages: ReadonlyMap<string, string>) {
  const server = await startPageServer(pages, 0);
  servers.push(server);
  return server;
}

describe("the recipe page server", () => {
  it("should serve a page as html at its path", async () => {
    const server = await started(new Map([["/pages/a.html", "<p>a page</p>"]]));

    const response = await fetch(`http://127.0.0.1:${server.port}/pages/a.html`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await response.text()).toBe("<p>a page</p>");
  });

  it("should answer 404 for a path it does not hold, whatever the query", async () => {
    const server = await started(new Map([["/pages/a.html", "<p>a</p>"]]));

    const response = await fetch(`http://127.0.0.1:${server.port}/pages/b.html?x=/pages/a.html`);

    expect(response.status).toBe(404);
  });

  it("should serve a path with a query string from the path alone", async () => {
    const server = await started(new Map([["/pages/a.html", "<p>a</p>"]]));

    const response = await fetch(`http://127.0.0.1:${server.port}/pages/a.html?utm=1`);

    expect(response.status).toBe(200);
  });

  it("should answer 400 for a target that is not a path, and keep serving", async () => {
    const server = await started(new Map([["/pages/a.html", "<p>a</p>"]]));

    const statuses = await Promise.all(
      ["//", "///"].map(
        async (target) => (await fetch(`http://127.0.0.1:${server.port}${target}`)).status,
      ),
    );
    const after = await fetch(`http://127.0.0.1:${server.port}/pages/a.html`);

    expect(statuses).toEqual([400, 400]);
    expect(after.status).toBe(200);
  });

  it("should refuse anything but GET", async () => {
    const server = await started(new Map([["/pages/a.html", "<p>a</p>"]]));

    const response = await fetch(`http://127.0.0.1:${server.port}/pages/a.html`, {
      method: "POST",
    });

    expect(response.status).toBe(405);
  });

  it("should stop listening when closed", async () => {
    const server = await startPageServer(new Map(), 0);
    const { port } = server;
    await server.close();

    await expect(fetch(`http://127.0.0.1:${port}/`)).rejects.toThrow();
  });

  it("should say which port is taken when it cannot listen", async () => {
    const first = await started(new Map());

    await expect(startPageServer(new Map(), first.port)).rejects.toThrow(
      `port ${first.port} is already in use`,
    );
  });
});

describe("recipePageUrl", () => {
  it("should be an ordinary https link on the reserved host", () => {
    expect(recipePageUrl("/pages/a.html")).toBe(`https://${RECIPE_PAGE_HOST}/pages/a.html`);
  });
});

// The function reads the test origin from `.env.test` and the runner listens on the constant, so the two
// meet only if these files agree. This is the one place they are compared.
describe("the settings of the served functions", () => {
  const envTest = readFileSync(
    new URL("../../../packages/db/supabase/functions/.env.test", import.meta.url),
    "utf8",
  );
  const seam = readFileSync(
    new URL(
      "../../../packages/db/supabase/functions/_shared/recipePageTestOrigin.ts",
      import.meta.url,
    ),
    "utf8",
  );

  it("should point RECIPE_PAGE_TEST_ORIGIN at the port the runner listens on", () => {
    const origin = /^RECIPE_PAGE_TEST_ORIGIN=(.+)$/m.exec(envTest)?.[1];

    expect(origin).toBe(`http://host.docker.internal:${RECIPE_PAGE_SERVER_PORT}`);
  });

  // A source check, so it proves the line is there and not that it runs. The first live run is the real proof.
  it("should be wired into the fetch of the mcp function by a line that is not a comment", () => {
    const mcp = readFileSync(
      new URL("../../../packages/db/supabase/functions/mcp/index.ts", import.meta.url),
      "utf8",
    );

    expect(mcp).toMatch(
      /fetchRecipePage\(url, \{[^}]*^[ \t]*\.\.\.recipePageTestOverrides\(\(name\) => Deno\.env\.get\(name\)\),?$/ms,
    );
  });

  it("should reserve the same host name as the seam", () => {
    const host = /RECIPE_PAGE_TEST_HOST = "([^"]+)"/.exec(seam)?.[1];

    expect(host).toBe(RECIPE_PAGE_HOST);
  });

  it("should keep the port away from the mock, the Supabase stack and the inspector", () => {
    const taken = [24399, 8083, ...Array.from({ length: 10 }, (_unused, offset) => 54320 + offset)];

    expect(taken).not.toContain(RECIPE_PAGE_SERVER_PORT);
  });
});
