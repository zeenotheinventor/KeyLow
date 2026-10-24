// Response helpers shared by every Edge Function: JSON bodies, the typed error body and CORS.
// The error body and its codes are the @keylow/core contract, so the functions and the api-client
// share one definition.
import type { EdgeErrorCode } from "./core.ts";
import { type ReportError, reportError } from "./report.ts";

const statusByCode: Record<EdgeErrorCode, number> = {
  not_found: 404,
  rate_limited: 429,
  upstream_error: 502,
  invalid_request: 400,
  unauthorized: 401,
  internal_error: 500,
  bad_mode: 400,
  no_program: 409,
  missing_stats: 409,
};

// Browsers call these functions directly from the web app, so every response carries CORS headers.
// Authentication is a bearer token, never a cookie, which makes a wildcard origin safe.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(corsHeaders)) {
    headers.set(name, value);
  }
  return Response.json(body, { ...init, headers });
}

export function error(
  code: EdgeErrorCode,
  message: string,
  options: { retryAfterSeconds?: number } = {},
): Response {
  const { retryAfterSeconds } = options;
  const body = {
    error: { code, message, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) },
  };
  const headers = new Headers();
  if (retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(retryAfterSeconds));
  }
  return json(body, { status: statusByCode[code], headers });
}

// Returns the response to send for a preflight request, or null when the request is not one.
function handlePreflight(request: Request): Response | null {
  if (request.method !== "OPTIONS") {
    return null;
  }
  return new Response(null, { status: 204, headers: corsHeaders });
}

// Wraps a function's request handler. It answers the CORS preflight, and turns an uncaught throw
// into a typed 500 that carries the CORS headers. Without it a throw reaches the browser as a plain
// text 500 that the gateway sends without CORS headers, which the browser reports as a network error.
// The throw is reported to Sentry once, without the request or the error's message (see report.ts).
// Every function entry is `Deno.serve(handle("<function name>", async (request) => { ... }))`.
export function handle(
  functionName: string,
  handler: (request: Request) => Response | Promise<Response>,
  report: ReportError = reportError,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const preflight = handlePreflight(request);
    if (preflight !== null) {
      return preflight;
    }
    try {
      return await handler(request);
    } catch (caught) {
      report(functionName, "internal_error", caught);
      return error("internal_error", "Internal error");
    }
  };
}
