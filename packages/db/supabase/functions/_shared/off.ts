// Fetch wrapper for the Open Food Facts API. `fetchOff` adds what every call needs and returns the
// raw response, for callers that read non-2xx answers themselves (a 404 for an unknown barcode, say).
// `offRequest` is the common case: it turns a timeout, a network error or a non-2xx answer into the
// typed `upstream_error` response. Deferred to the functions that use them: building paths, parsing
// bodies and retries.
import { error } from "./http.ts";

const defaultBaseUrl = "https://world.openfoodfacts.org";
const defaultTimeoutMilliseconds = 5000;

type OffFetchOptions = {
  // Query parameters other than `fields`.
  searchParams?: Record<string, string>;
  // The product fields to return. OFF sends whole documents unless asked for less.
  fields: readonly string[];
  timeoutMilliseconds?: number;
  // Non-2xx statuses the caller reads itself, such as 404 for an unknown barcode. `offRequest` hands
  // these back as `ok` responses instead of turning them into an `upstream_error`.
  acceptedStatuses?: readonly number[];
};

export type OffResult = { ok: true; response: Response } | { ok: false; failure: Response };

// Open Food Facts asks every client to identify itself, so a missing User-Agent is a
// configuration error, never something to default.
function requireUserAgent(): string {
  const userAgent = Deno.env.get("OFF_USER_AGENT");
  if (!userAgent) {
    throw new Error("OFF_USER_AGENT is not set. Open Food Facts requires a User-Agent.");
  }
  return userAgent;
}

// A configuration problem (a missing User-Agent, an invalid base URL) throws here, before any
// request is made, so it is never mistaken for an upstream failure.
function buildRequest(path: string, options: OffFetchOptions): { url: URL; init: RequestInit } {
  const baseUrl = Deno.env.get("OFF_BASE_URL") || defaultBaseUrl;
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

// `path` starts with a slash, for example `/api/v2/product/5000112637922`.
export async function fetchOff(path: string, options: OffFetchOptions): Promise<Response> {
  const { url, init } = buildRequest(path, options);
  return await fetch(url, init);
}

function isTimeout(caught: unknown): boolean {
  return caught instanceof DOMException && caught.name === "TimeoutError";
}

// Returns the 2xx response (or one of the `acceptedStatuses`), or the `upstream_error` response to
// send back.
export async function offRequest(path: string, options: OffFetchOptions): Promise<OffResult> {
  const { url, init } = buildRequest(path, options);
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (caught) {
    console.error("Open Food Facts request failed", caught);
    const message = isTimeout(caught)
      ? "Open Food Facts took too long to answer."
      : "Open Food Facts could not be reached.";
    return { ok: false, failure: error("upstream_error", message) };
  }
  if (!response.ok && !options.acceptedStatuses?.includes(response.status)) {
    console.error(`Open Food Facts answered ${response.status} for ${url.pathname}`);
    await response.body?.cancel();
    return {
      ok: false,
      failure: error("upstream_error", "Open Food Facts answered with an error."),
    };
  }
  return { ok: true, response };
}
