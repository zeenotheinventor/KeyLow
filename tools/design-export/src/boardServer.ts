// A local static server that stands in for the canvas host while the boards render. It serves the
// board files, the files the canvas uploaded as /_blob/ assets, and the runtime under the name the
// boards load (support.js). The runtime is third-party code, so it is read from the path given and
// never copied into the repository.
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";

import type { CanvasAsset } from "./assets.ts";

export type BoardServerOptions = {
  designDirectory: string;
  // The folder under designDirectory that holds the canvas source to serve, such as source-m3.
  sourceFolder: string;
  assets: readonly CanvasAsset[];
  runtimePath: string;
  // Defaults to a free port the system picks.
  port?: number | undefined;
};

export type BoardServer = {
  origin: string;
  close: () => Promise<void>;
};

const boardFileName = /^\/[A-Za-z0-9.-]+\.dc\.html$/;

async function readOrUndefined(path: string): Promise<Buffer | undefined> {
  try {
    return await readFile(path);
  } catch {
    return undefined;
  }
}

export async function startBoardServer(options: BoardServerOptions): Promise<BoardServer> {
  const projectDirectory = join(options.designDirectory, options.sourceFolder, "project");
  const server = createServer((request, response) => {
    void (async () => {
      const path = (request.url ?? "/").split("?")[0] ?? "/";
      const asset = options.assets.find((candidate) => candidate.blob === path);
      let found: { body: Buffer | undefined; contentType: string } | undefined;
      if (path === "/support.js") {
        found = {
          body: await readOrUndefined(options.runtimePath),
          contentType: "text/javascript",
        };
      } else if (asset !== undefined) {
        found = {
          body: await readOrUndefined(
            join(options.designDirectory, options.sourceFolder, asset.file),
          ),
          contentType: asset.contentType,
        };
      } else if (boardFileName.test(path)) {
        found = {
          body: await readOrUndefined(join(projectDirectory, path)),
          contentType: "text/html",
        };
      }
      if (found?.body === undefined) {
        response.statusCode = 404;
        response.end();
        return;
      }
      response.setHeader("content-type", `${found.contentType}; charset=utf-8`);
      response.end(found.body);
    })();
  });
  await new Promise<void>((resolve) => {
    server.listen(options.port ?? 0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("The board server has no port");
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) {
            resolve();
          } else {
            reject(error);
          }
        });
        server.closeAllConnections();
      }),
  };
}
