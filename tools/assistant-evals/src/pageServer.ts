import { createServer } from "node:http";

// The server that gives the recipe import evals their pages (KEY-701). The served `mcp` function fetches a
// page only at an ordinary public web address, so the cases write links on one reserved host and the function
// is told (by `RECIPE_PAGE_TEST_ORIGIN` in `packages/db/supabase/functions/.env.test`, on a local stack only)
// to read that host from this server. The host and the port must equal the function's side: a test in
// `test/pageServer.test.ts` reads that file and compares. KEY-702's page cases add their pages to the same
// registry (`fixtures/pages/index.ts`) and use the same server.
//
// The pages are plain strings held in memory. This reads no file, and it answers only GET for a path it holds.

/** The reserved name the function reads from this server. The same string is in `recipePageTestOrigin.ts`. */
export const RECIPE_PAGE_HOST = "recipes.keylow.test";

/** Beside the msw mock's 24399, and away from the Supabase stack (54320 to 54329) and the inspector (8083). */
export const RECIPE_PAGE_SERVER_PORT = 24401;

/** The link a case writes in its message for a page at `path`. */
export const recipePageUrl = (path: string): string => `https://${RECIPE_PAGE_HOST}${path}`;

function pathOf(target: string | undefined): string | null {
  try {
    return new URL(target ?? "/", "http://localhost").pathname;
  } catch {
    return null;
  }
}

export type PageServer = Readonly<{ port: number; close: () => Promise<void> }>;

/**
 * Starts the server on every interface, because the function reads it from a container through the Docker
 * gateway. `pages` maps a path to the html served there. A port of 0 takes a free one, for tests.
 */
export function startPageServer(
  pages: ReadonlyMap<string, string>,
  port: number = RECIPE_PAGE_SERVER_PORT,
): Promise<PageServer> {
  const server = createServer((request, response) => {
    if (request.method !== "GET") {
      response.writeHead(405).end();
      return;
    }
    // A target such as "//" or "///" is not a path `URL` accepts. It is a bad request and not a reason to stop.
    const path = pathOf(request.url);
    if (path === null) {
      response.writeHead(400).end();
      return;
    }
    const html = pages.get(path);
    if (html === undefined) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
  });

  return new Promise((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) => {
      reject(
        error.code === "EADDRINUSE"
          ? new Error(`The recipe page server could not start: port ${port} is already in use`)
          : error,
      );
    });
    server.listen(port, "0.0.0.0", () => {
      const address = server.address();
      resolve({
        port: typeof address === "object" && address !== null ? address.port : port,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => {
              done();
            });
            server.closeAllConnections();
          }),
      });
    });
  });
}
