// A stand-in for Open Food Facts, started by the global setup. The Edge Function runs in a
// container, so an in-process msw `setupServer` cannot intercept its fetch. This is a real HTTP
// server on the host instead. It is a plain node:http server because @mswjs/http-middleware calls
// `handleRequest` from msw, which msw 3 (the version api-client uses) no longer exports, and
// adding msw 2 beside it would split the lockfile for sixty lines of routing.
//
// Control endpoints, used by the test side (offMock.ts):
//   POST /__mock/register          register what a code answers
//   POST /__mock/register-search   register what a search for some words answers
//   GET  /__mock/calls             the requests recorded for ?code= (product lookups) or
//                                  ?searchTerms= (searches)
//   POST /__mock/reset             forget every registration and call
// Endpoints the functions call:
//   GET  /api/v2/product/<code>
//   GET  /cgi/search.pl?search_terms=<words>
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { text } from "node:stream/consumers";
import { setTimeout as delay } from "node:timers/promises";

import type {
  RecordedCall,
  RecordedSearchCall,
  RegisterProduct,
  RegisterSearch,
  RegisterSearchProduct,
} from "./offMock";
import type { IncomingMessage, Server, ServerResponse } from "node:http";

const fixtureDirectory = new URL("../../../../core/test/fixtures/off/", import.meta.url);
const plainFileName = /^[a-z0-9-]+$/;
const productPath = /^\/api\/v2\/product\/([^/]+)$/;
const searchPath = "/cgi/search.pl";

// `rawText` is sent verbatim as HTML instead of `body` as JSON.
type Answer = { status: number; body: unknown; delayMilliseconds: number; rawText?: string };

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
  const product = buildProduct({ ...registration, fixture: registration.fixture });
  return {
    status,
    body: { code: registration.code, status: 1, status_verbose: "product found", product },
    delayMilliseconds,
  };
}

function buildProduct(
  registration: Pick<RegisterProduct, "code" | "productOverrides"> & { fixture: string },
): Record<string, unknown> {
  return {
    ...readFixture(registration.fixture),
    code: registration.code,
    ...registration.productOverrides,
  };
}

// The envelope `/cgi/search.pl?json=1` wraps its products in.
function searchEnvelope(products: Record<string, unknown>[]): Record<string, unknown> {
  return { count: products.length, page: 1, page_count: products.length, page_size: 20, products };
}

function searchAnswerFor(registration: RegisterSearch): Answer {
  const status = registration.status ?? 200;
  const delayMilliseconds = registration.delayMilliseconds ?? 0;
  if (registration.rawBody !== undefined) {
    return { status, body: null, rawText: registration.rawBody, delayMilliseconds };
  }
  if (registration.body !== undefined) {
    return { status, body: registration.body, delayMilliseconds };
  }
  const products = (registration.products ?? []).map((product) => buildProduct(product));
  return { status, body: searchEnvelope(products), delayMilliseconds };
}

function emptySearchAnswer(): Answer {
  return { status: 200, body: searchEnvelope([]), delayMilliseconds: 0 };
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

function sendAnswer(response: ServerResponse, answer: Answer): void {
  if (answer.rawText === undefined) {
    send(response, answer.status, answer.body);
    return;
  }
  response.writeHead(answer.status, { "Content-Type": "text/html; charset=utf-8" });
  response.end(answer.rawText);
}

function readHeaders(request: IncomingMessage): Record<string, string> {
  return Object.fromEntries(
    Object.entries(request.headers).flatMap(([name, value]) =>
      typeof value === "string" ? [[name, value]] : [],
    ),
  );
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

function toSearchProduct(body: unknown): RegisterSearchProduct {
  const { code, fixture, productOverrides } = toRegistration(body);
  if (fixture === undefined) {
    throw new Error("A search product needs a fixture");
  }
  return { code, fixture, ...(productOverrides === undefined ? {} : { productOverrides }) };
}

function toSearchRegistration(body: unknown): RegisterSearch {
  if (!isRecord(body) || typeof body["searchTerms"] !== "string") {
    throw new Error("A search registration needs string searchTerms");
  }
  return {
    searchTerms: body["searchTerms"],
    ...(Array.isArray(body["products"]) ? { products: body["products"].map(toSearchProduct) } : {}),
    ...(body["body"] === undefined ? {} : { body: body["body"] }),
    ...(typeof body["rawBody"] === "string" ? { rawBody: body["rawBody"] } : {}),
    ...(typeof body["status"] === "number" ? { status: body["status"] } : {}),
    ...(typeof body["delayMilliseconds"] === "number"
      ? { delayMilliseconds: body["delayMilliseconds"] }
      : {}),
  };
}

export type OffMockServer = {
  /** The port the server listens on, which is the one the operating system chose for port 0. */
  port: number;
  close: () => Promise<void>;
};

function listeningPort(server: Server): number {
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("The OFF mock is not listening on a TCP port");
  }
  return address.port;
}

/**
 * Starts the mock on every interface, because a container reaches the host through the gateway.
 * Pass port 0 to take any free port. A start that fails says which port and why.
 */
export function startOffMock(port: number): Promise<OffMockServer> {
  const answers = new Map<string, Answer>();
  const searchAnswers = new Map<string, Answer>();
  const calls: RecordedCall[] = [];
  const searchCalls: RecordedSearchCall[] = [];

  async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", "http://mock.local");

    if (request.method === "POST" && url.pathname === "/__mock/register") {
      const registration = toRegistration(await readJson(request));
      answers.set(registration.code, answerFor(registration));
      send(response, 204, null);
      return;
    }
    if (request.method === "POST" && url.pathname === "/__mock/register-search") {
      const registration = toSearchRegistration(await readJson(request));
      searchAnswers.set(registration.searchTerms, searchAnswerFor(registration));
      send(response, 204, null);
      return;
    }
    if (request.method === "GET" && url.pathname === "/__mock/calls") {
      const searchTerms = url.searchParams.get("searchTerms");
      if (searchTerms !== null) {
        send(
          response,
          200,
          searchCalls.filter((call) => call.searchTerms === searchTerms),
        );
        return;
      }
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
      searchAnswers.clear();
      calls.length = 0;
      searchCalls.length = 0;
      send(response, 204, null);
      return;
    }

    if (request.method === "GET" && url.pathname === searchPath) {
      const searchTerms = url.searchParams.get("search_terms") ?? "";
      searchCalls.push({
        searchTerms,
        url: `${url.pathname}${url.search}`,
        query: Object.fromEntries(url.searchParams),
        headers: readHeaders(request),
      });
      const answer = searchAnswers.get(searchTerms) ?? emptySearchAnswer();
      await delay(answer.delayMilliseconds);
      sendAnswer(response, answer);
      return;
    }

    const code = productPath.exec(url.pathname)?.[1];
    if (request.method === "GET" && code !== undefined) {
      calls.push({
        code,
        url: `${url.pathname}${url.search}`,
        query: Object.fromEntries(url.searchParams),
        headers: readHeaders(request),
      });
      const answer = answers.get(code) ?? notFoundAnswer(code);
      await delay(answer.delayMilliseconds);
      sendAnswer(response, answer);
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
    server.once("error", (cause) => {
      reject(
        new Error(`Could not start the OFF mock on port ${port}: ${cause.message}`, { cause }),
      );
    });
    server.listen(port, "0.0.0.0", () => {
      resolve({
        port: listeningPort(server),
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
