// A stand-in for Open Food Facts, started by the global setup. The Edge Function runs in a
// container, so an in-process msw `setupServer` cannot intercept its fetch. This is a real HTTP
// server on the host instead. It is a plain node:http server because @mswjs/http-middleware calls
// `handleRequest` from msw, which msw 3 (the version api-client uses) no longer exports, and
// adding msw 2 beside it would split the lockfile for sixty lines of routing.
//
// Control endpoints, used by the test side (offMock.ts):
//   POST /__mock/register   register what a code answers
//   GET  /__mock/calls      the requests recorded for ?code=
//   POST /__mock/reset      forget every registration and call
// Product endpoint, called by the function:
//   GET  /api/v2/product/<code>
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { text } from "node:stream/consumers";
import { setTimeout as delay } from "node:timers/promises";

import type { RecordedCall, RegisterProduct } from "./offMock";
import type { IncomingMessage, Server, ServerResponse } from "node:http";

const fixtureDirectory = new URL("../../../../core/test/fixtures/off/", import.meta.url);
const plainFileName = /^[a-z0-9-]+$/;
const productPath = /^\/api\/v2\/product\/([^/]+)$/;

type Answer = { status: number; body: unknown; delayMilliseconds: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function readFixture(name: string): Record<string, unknown> {
  if (!plainFileName.test(name)) {
    throw new Error(`The fixture name "${name}" is not a plain file name`);
  }
  const fixture: unknown = JSON.parse(
    readFileSync(new URL(`${name}.json`, fixtureDirectory), "utf8"),
  );
  if (!isRecord(fixture)) {
    throw new Error(`The fixture ${name} is not a JSON object`);
  }
  return fixture;
}

// The v2 envelope Open Food Facts wraps a product in.
function answerFor(registration: RegisterProduct): Answer {
  const status = registration.status ?? 200;
  const delayMilliseconds = registration.delayMilliseconds ?? 0;
  if (registration.body !== undefined) {
    return { status, body: registration.body, delayMilliseconds };
  }
  if (registration.fixture === undefined) {
    throw new Error("Register a fixture or a body");
  }
  const product = {
    ...readFixture(registration.fixture),
    code: registration.code,
    ...registration.productOverrides,
  };
  return {
    status,
    body: { code: registration.code, status: 1, status_verbose: "product found", product },
    delayMilliseconds,
  };
}

function notFoundAnswer(code: string): Answer {
  return {
    status: 404,
    body: { code, status: 0, status_verbose: "product not found" },
    delayMilliseconds: 0,
  };
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  return JSON.parse(await text(request));
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function toRegistration(body: unknown): RegisterProduct {
  if (!isRecord(body) || typeof body["code"] !== "string") {
    throw new Error("A registration needs a string code");
  }
  return {
    code: body["code"],
    ...(typeof body["fixture"] === "string" ? { fixture: body["fixture"] } : {}),
    ...(isRecord(body["productOverrides"]) ? { productOverrides: body["productOverrides"] } : {}),
    ...(body["body"] === undefined ? {} : { body: body["body"] }),
    ...(typeof body["status"] === "number" ? { status: body["status"] } : {}),
    ...(typeof body["delayMilliseconds"] === "number"
      ? { delayMilliseconds: body["delayMilliseconds"] }
      : {}),
  };
}

export type OffMockServer = { close: () => Promise<void> };

/** Starts the mock on every interface, because a container reaches the host through the gateway. */
export function startOffMock(port: number): Promise<OffMockServer> {
  const answers = new Map<string, Answer>();
  const calls: RecordedCall[] = [];

  async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", "http://mock.local");

    if (request.method === "POST" && url.pathname === "/__mock/register") {
      const registration = toRegistration(await readJson(request));
      answers.set(registration.code, answerFor(registration));
      send(response, 204, null);
      return;
    }
    if (request.method === "GET" && url.pathname === "/__mock/calls") {
      const code = url.searchParams.get("code");
      send(
        response,
        200,
        calls.filter((call) => code === null || call.code === code),
      );
      return;
    }
    if (request.method === "POST" && url.pathname === "/__mock/reset") {
      answers.clear();
      calls.length = 0;
      send(response, 204, null);
      return;
    }

    const code = productPath.exec(url.pathname)?.[1];
    if (request.method === "GET" && code !== undefined) {
      calls.push({
        code,
        query: Object.fromEntries(url.searchParams),
        headers: Object.fromEntries(
          Object.entries(request.headers).flatMap(([name, value]) =>
            typeof value === "string" ? [[name, value]] : [],
          ),
        ),
      });
      const answer = answers.get(code) ?? notFoundAnswer(code);
      await delay(answer.delayMilliseconds);
      send(response, answer.status, answer.body);
      return;
    }
    send(response, 404, { error: `No mock route for ${request.method} ${url.pathname}` });
  }

  const server: Server = createServer((request, response) => {
    route(request, response).catch((caught: unknown) => {
      send(response, 400, { error: caught instanceof Error ? caught.message : String(caught) });
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => {
      resolve({
        close: () =>
          new Promise((done, fail) => {
            server.close((closeError) => {
              if (closeError) {
                fail(closeError);
              } else {
                done();
              }
            });
            server.closeAllConnections();
          }),
      });
    });
  });
}
