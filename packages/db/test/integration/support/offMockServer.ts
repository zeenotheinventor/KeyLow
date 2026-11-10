// A stand-in for Open Food Facts, started by the global setup. The Edge Function runs in a
// container, so an in-process msw `setupServer` cannot intercept its fetch. This is a real HTTP
// server on the host instead. It is a plain node:http server because @mswjs/http-middleware calls
// `handleRequest` from msw, which msw 3 (the version api-client uses) no longer exports, and
// adding msw 2 beside it would split the lockfile for sixty lines of routing.
//
// Control endpoints, used by the test side (offMock.ts):
//   POST /__mock/register          register what a code answers
//   POST /__mock/register-search   register what a search for some words answers, and what the
//                                  repeats of that search answer after it
//   GET  /__mock/calls             the requests recorded for ?code= (product lookups) or
//                                  ?searchTerms= (searches)
//   POST /__mock/reset             forget every registration and call
// Endpoints the functions call:
//   GET  /api/v2/product/<code>
//   GET  /search?q=<words> countries_tags:"..." nutriments:*   Search-a-licious, answering {hits}
//   POST /anthropic/v1/messages    the Messages API, streamed, from a script a test registers
// Control endpoints for the Messages API, used by the test side (anthropicMock.ts). A script is keyed by
// a marker the test puts in its user text, so parallel suites never mix. `reset` leaves them alone,
// because it would wipe the scripts of a suite running at the same time.
//   POST /__mock/anthropic/register   register the replies for a marker
//   GET  /__mock/anthropic/requests   the request bodies recorded for ?marker=
//   POST /__mock/anthropic/forget     forget the replies and requests of a marker
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { text } from "node:stream/consumers";
import { setTimeout as delay } from "node:timers/promises";

import { isScriptedReplyList } from "./anthropicMock";
import { defaultReply, messageStreamOf } from "./anthropicStream";

import type { ModelRequestBody, ScriptedReply } from "./anthropicMock";
import type {
  RecordedCall,
  RecordedSearchCall,
  RegisterProduct,
  RegisterSearch,
  RegisterSearchAnswer,
  RegisterSearchProduct,
} from "./offMock";
import type { IncomingMessage, Server, ServerResponse } from "node:http";

const fixtureDirectory = new URL("../../../../core/test/fixtures/off/", import.meta.url);
const plainFileName = /^[a-z0-9-]+$/;
const productPath = /^\/api\/v2\/product\/([^/]+)$/;
const searchPath = "/search";
// The clauses the function adds to the typed words, which a test's searchTerms leave out.
const searchFilterClauses = /\s*countries_tags:"[^"]*"|\s*nutriments:\*/g;

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

// The envelope Search-a-licious wraps its hits in.
function searchEnvelope(hits: Record<string, unknown>[]): Record<string, unknown> {
  return {
    hits,
    count: hits.length,
    page: 1,
    page_size: 20,
    page_count: hits.length === 0 ? 0 : 1,
    timed_out: false,
  };
}

// Search-a-licious sends `brands` as an array, where a product fixture has the string v2 sends.
function toHit(product: Record<string, unknown>): Record<string, unknown> {
  const { brands } = product;
  return typeof brands === "string"
    ? { ...product, brands: brands.split(",").map((brand) => brand.trim()) }
    : product;
}

function searchAnswerFor(registration: RegisterSearchAnswer): Answer {
  const status = registration.status ?? 200;
  const delayMilliseconds = registration.delayMilliseconds ?? 0;
  if (registration.rawBody !== undefined) {
    return { status, body: null, rawText: registration.rawBody, delayMilliseconds };
  }
  if (registration.body !== undefined) {
    return { status, body: registration.body, delayMilliseconds };
  }
  const hits = (registration.products ?? []).map((product) => toHit(buildProduct(product)));
  return { status, body: searchEnvelope(hits), delayMilliseconds };
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

function toSearchAnswer(body: Record<string, unknown>): RegisterSearchAnswer {
  return {
    ...(Array.isArray(body["products"]) ? { products: body["products"].map(toSearchProduct) } : {}),
    ...(body["body"] === undefined ? {} : { body: body["body"] }),
    ...(typeof body["rawBody"] === "string" ? { rawBody: body["rawBody"] } : {}),
    ...(typeof body["status"] === "number" ? { status: body["status"] } : {}),
    ...(typeof body["delayMilliseconds"] === "number"
      ? { delayMilliseconds: body["delayMilliseconds"] }
      : {}),
  };
}

function toSearchRegistration(body: unknown): RegisterSearch {
  if (!isRecord(body) || typeof body["searchTerms"] !== "string") {
    throw new Error("A search registration needs string searchTerms");
  }
  const followedBy = Array.isArray(body["followedBy"])
    ? body["followedBy"].map((answer: unknown) => {
        if (!isRecord(answer)) {
          throw new Error("Each followedBy answer must be an object");
        }
        return toSearchAnswer(answer);
      })
    : undefined;
  return {
    searchTerms: body["searchTerms"],
    ...toSearchAnswer(body),
    ...(followedBy === undefined ? {} : { followedBy }),
  };
}

// The Messages API's own error body, with a fixed message so a request is never quoted back.
function sendModelError(
  response: ServerResponse,
  status: number,
  type: string,
  message: string,
): void {
  send(response, status, { type: "error", error: { type, message } });
}

// The key the request carries: `x-api-key` (the API's documented header) or a bearer token, which is how
// the SDK in the `assistant` function sends it. Empty when there is none.
function apiKeyOf(request: IncomingMessage): string {
  const header = request.headers["x-api-key"];
  if (typeof header === "string" && header !== "") {
    return header;
  }
  return (request.headers.authorization ?? "").replace(/^Bearer\s*/i, "");
}

// A marker is found in the body text, so a short one would match by accident.
const MIN_MARKER_LENGTH = 8;

function toScriptRegistration(body: unknown): { marker: string; replies: ScriptedReply[] } {
  if (
    !isRecord(body) ||
    typeof body["marker"] !== "string" ||
    body["marker"].length < MIN_MARKER_LENGTH ||
    !isScriptedReplyList(body["replies"])
  ) {
    throw new Error(
      `A script needs a marker of at least ${MIN_MARKER_LENGTH} characters and a list of replies`,
    );
  }
  return { marker: body["marker"], replies: body["replies"] };
}

function toMarker(body: unknown): string {
  if (!isRecord(body) || typeof body["marker"] !== "string") {
    throw new Error("A request needs a string marker");
  }
  return body["marker"];
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
  const searchAnswers = new Map<string, Answer[]>();
  const calls: RecordedCall[] = [];
  const searchCalls: RecordedSearchCall[] = [];
  const modelScripts = new Map<string, ScriptedReply[]>();
  const modelRequests = new Map<string, ModelRequestBody[]>();

  // Streams the reply the request's marker scripts, or the default reply when no registered marker is in
  // the body. The function only ever sends streamed requests with an API key.
  async function answerMessages(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (apiKeyOf(request) === "") {
      sendModelError(response, 401, "authentication_error", "invalid x-api-key");
      return;
    }
    const bodyText = await text(request);
    const body: unknown = JSON.parse(bodyText);
    if (!isRecord(body) || body["stream"] !== true) {
      sendModelError(
        response,
        400,
        "invalid_request_error",
        "the mock only answers streamed requests",
      );
      return;
    }
    const marker = [...modelScripts.keys()].find((registered) => bodyText.includes(registered));
    let reply = defaultReply;
    let index = 0;
    if (marker !== undefined) {
      const recorded = modelRequests.get(marker) ?? [];
      recorded.push(body);
      modelRequests.set(marker, recorded);
      index = recorded.length - 1;
      const scripted = modelScripts.get(marker)?.[index];
      if (scripted === undefined) {
        sendModelError(response, 400, "invalid_request_error", "the script has no reply left");
        return;
      }
      reply = scripted;
    }
    response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    response.end(messageStreamOf(reply, index));
  }

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
      searchAnswers.set(registration.searchTerms, [
        searchAnswerFor(registration),
        ...(registration.followedBy ?? []).map(searchAnswerFor),
      ]);
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
    if (request.method === "POST" && url.pathname === "/anthropic/v1/messages") {
      await answerMessages(request, response);
      return;
    }
    if (request.method === "POST" && url.pathname === "/__mock/anthropic/register") {
      const { marker, replies } = toScriptRegistration(await readJson(request));
      modelScripts.set(marker, replies);
      modelRequests.set(marker, []);
      send(response, 204, null);
      return;
    }
    if (request.method === "GET" && url.pathname === "/__mock/anthropic/requests") {
      send(response, 200, modelRequests.get(url.searchParams.get("marker") ?? "") ?? []);
      return;
    }
    if (request.method === "POST" && url.pathname === "/__mock/anthropic/forget") {
      const marker = toMarker(await readJson(request));
      modelScripts.delete(marker);
      modelRequests.delete(marker);
      send(response, 204, null);
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
      const searchTerms = (url.searchParams.get("q") ?? "").replace(searchFilterClauses, "").trim();
      const earlierCalls = searchCalls.filter((call) => call.searchTerms === searchTerms).length;
      searchCalls.push({
        searchTerms,
        url: `${url.pathname}${url.search}`,
        query: Object.fromEntries(url.searchParams),
        headers: readHeaders(request),
      });
      const registered = searchAnswers.get(searchTerms);
      const answer =
        registered?.[Math.min(earlierCalls, registered.length - 1)] ?? emptySearchAnswer();
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
