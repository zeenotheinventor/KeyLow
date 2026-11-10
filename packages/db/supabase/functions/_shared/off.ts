// Fetch wrapper for the Open Food Facts API. `offRequest` adds what every call needs and turns a
// timeout, a network error or a non-2xx answer into the typed `upstream_error` response, except a
// 429, which becomes `rate_limited` with the wait Open Food Facts asked for. A status the caller
// reads itself (a 404 for an unknown barcode, say) is listed in `acceptedStatuses`. Deferred to the
// functions that use it: building paths, parsing bodies and retries. A caller that retries sets
// `reportFailures: false` on the attempts it may follow with another, and reports the last one.
import { error } from "./http.ts";
import { reportError } from "./report.ts";

const defaultBaseUrl = "https://world.openfoodfacts.org";
const defaultTimeoutMilliseconds = 5000;

type OffFetchOptions = {
  // The function making the call, named on the report when OFF fails.
  functionName: string;
  // Query parameters other than `fields`.
  searchParams?: Record<string, string>;
  // The product fields to return. OFF sends whole documents unless asked for less.
  fields: readonly string[];
  timeoutMilliseconds?: number;
  // Non-2xx statuses the caller reads itself, such as 404 for an unknown barcode. `offRequest` hands
  // these back as `ok` responses instead of turning them into an `upstream_error`.
  acceptedStatuses?: readonly number[];
  // The host to call when `OFF_BASE_URL` is not set, for a function that talks to a different Open
  // Food Facts service than the product API. `OFF_BASE_URL` still wins, so the tests' mock answers
  // every function.
  baseUrl?: string;
  // Set to false to stay quiet about a timeout, a network error or a 5xx, because the caller will
  // retry it and report the last failure itself. A 429 is always reported, since it is never retried.
  reportFailures?: boolean;
};

// `upstreamStatus` is the status Open Food Facts answered with, and is missing when there was no
// answer (a timeout or a network error). A caller that retries reads it to tell a 5xx from a 4xx.
export type OffResult =
  { ok: true; response: Response } | { ok: false; failure: Response; upstreamStatus?: number };

// Open Food Facts asks every client to identify itself, so a missing User-Agent is a
// configuration error, never something to default.
export function requireUserAgent(): string {
  const userAgent = Deno.env.get("OFF_USER_AGENT");
  if (!userAgent) {
    throw new Error("OFF_USER_AGENT is not set. Open Food Facts requires a User-Agent.");
  }
  return userAgent;
}

// A configuration problem (a missing User-Agent, an invalid base URL) throws here, before any
// request is made, so it is never mistaken for an upstream failure.
function buildRequest(path: string, options: OffFetchOptions): { url: URL; init: RequestInit } {
  const baseUrl = Deno.env.get("OFF_BASE_URL") || options.baseUrl || defaultBaseUrl;
  const url = new URL(path, baseUrl);
  for (const [name, value] of Object.entries(options.searchParams ?? {})) {
    url.searchParams.set(name, value);
  }
  url.searchParams.set("fields", options.fields.join(","));

  return {
    url,
    init: {
      headers: { "User-Agent": requireUserAgent(), Accept: "application/json" },
      signal: AbortSignal.timeout(options.timeoutMilliseconds ?? defaultTimeoutMilliseconds),
    },
  };
}

// The wait Open Food Facts asks for, when it sends one as a whole number of seconds above zero that
// a number can hold exactly. The header may also carry an HTTP date, which is ignored, because the
// contract only has seconds.
function retryAfterSecondsFrom(response: Response): number | undefined {
  const header = response.headers.get("Retry-After");
  if (header === null || !/^\d+$/.test(header)) {
    return undefined;
  }
  const seconds = Number(header);
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : undefined;
}

function isTimeout(caught: unknown): boolean {
  return caught instanceof DOMException && caught.name === "TimeoutError";
}

function reportUpstreamFailure(options: OffFetchOptions, caught: unknown): void {
  if (options.reportFailures !== false) {
    reportError(options.functionName, "upstream_error", caught);
  }
}

// Returns the 2xx response (or one of the `acceptedStatuses`), or the failure response to send back:
// `rate_limited` for a 429, `upstream_error` for anything else. `path` starts with a slash, for example `/api/v2/product/5000112637922`.
export async function offRequest(path: string, options: OffFetchOptions): Promise<OffResult> {
  const { url, init } = buildRequest(path, options);
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (caught) {
    reportUpstreamFailure(options, caught);
    const message = isTimeout(caught)
      ? "Open Food Facts took too long to answer."
      : "Open Food Facts could not be reached.";
    return { ok: false, failure: error("upstream_error", message) };
  }
  if (!response.ok && !options.acceptedStatuses?.includes(response.status)) {
    if (response.status === 429) {
      const retryAfterSeconds = retryAfterSecondsFrom(response);
      reportError(
        options.functionName,
        "rate_limited",
        new Error("Open Food Facts answered with a rate limit"),
      );
      await response.body?.cancel();
      return {
        ok: false,
        failure: error(
          "rate_limited",
          "Open Food Facts is busy.",
          retryAfterSeconds === undefined ? {} : { retryAfterSeconds },
        ),
        upstreamStatus: response.status,
      };
    }
    reportUpstreamFailure(options, new Error("Open Food Facts answered with an error status"));
    await response.body?.cancel();
    return {
      ok: false,
      failure: error("upstream_error", "Open Food Facts answered with an error."),
      upstreamStatus: response.status,
    };
  }
  return { ok: true, response };
}
