// The test side of the Open Food Facts mock: how a test registers a product and reads back the
// requests the function made. The server itself is in offMockServer.ts and runs in the global setup.

/**
 * The host port the function container reaches as `host.docker.internal:24399` (see .env.test).
 * It is below 32768 on purpose: an outgoing connection takes its source port from 32768 upward
 * (Linux) or 49152 upward (macOS), and a connection holding the mock's port makes the bind fail.
 */
export const offMockPort = 24399;

export type RegisterProduct = {
  /** The barcode the mock answers for. */
  code: string;
  /** A file name (without `.json`) in packages/core/test/fixtures/off. Served as the `product`. */
  fixture?: string;
  /** Fields merged over the fixture's product after its `code` is set to `code`. */
  productOverrides?: Record<string, unknown>;
  /** A raw response body, sent as it is. Use it for answers that are not a product. */
  body?: unknown;
  /** The response status. Defaults to 200. */
  status?: number;
  /** Holds the response back for this long, after the request is recorded. */
  delayMilliseconds?: number;
};

/** One product of a search answer, built like a registered product: a fixture with the code set. */
export type RegisterSearchProduct = Pick<RegisterProduct, "code" | "productOverrides"> & {
  fixture: string;
};

export type RegisterSearch = {
  /** The `search_terms` the mock answers for. A test uses words of its own, so searches never mix. */
  searchTerms: string;
  /** The products to serve, in order, inside the search envelope. */
  products?: RegisterSearchProduct[];
  /** A raw JSON response body, sent as it is. Use it for answers that are not a product list. */
  body?: unknown;
  /** A raw text response body, sent as it is with a text/html content type (OFF's busy page). */
  rawBody?: string;
  /** The response status. Defaults to 200. */
  status?: number;
  /** Holds the response back for this long, after the request is recorded. */
  delayMilliseconds?: number;
};

export type RecordedCall = {
  code: string;
  /** The request path and query string as the mock received them. */
  url: string;
  query: Record<string, string>;
  /** Lower-case header names, as Node reports them. */
  headers: Record<string, string>;
};

/** A search request. `code` is empty and `searchTerms` is the `search_terms` it carried. */
export type RecordedSearchCall = Omit<RecordedCall, "code"> & { searchTerms: string };

export type OffMockClient = {
  register: (product: RegisterProduct) => Promise<void>;
  calls: (code: string) => Promise<RecordedCall[]>;
  registerSearch: (search: RegisterSearch) => Promise<void>;
  searchCalls: (searchTerms: string) => Promise<RecordedSearchCall[]>;
  reset: () => Promise<void>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function isRecordedCallList(value: unknown): value is RecordedCall[] {
  return (
    Array.isArray(value) &&
    value.every(
      (call: unknown) =>
        isRecord(call) &&
        typeof call["code"] === "string" &&
        typeof call["url"] === "string" &&
        isRecord(call["query"]) &&
        isRecord(call["headers"]),
    )
  );
}

function isRecordedSearchCallList(value: unknown): value is RecordedSearchCall[] {
  return (
    Array.isArray(value) &&
    value.every(
      (call: unknown) =>
        isRecord(call) &&
        typeof call["searchTerms"] === "string" &&
        typeof call["url"] === "string" &&
        isRecord(call["query"]) &&
        isRecord(call["headers"]),
    )
  );
}

export function createOffMockClient(baseUrl: string): OffMockClient {
  async function send(path: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(`${baseUrl}${path}`, init);
    if (!response.ok) {
      throw new Error(`OFF mock ${path} answered ${response.status}: ${await response.text()}`);
    }
    return response;
  }

  return {
    async register(product) {
      await send("/__mock/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
    },
    async calls(code) {
      const response = await send(`/__mock/calls?code=${encodeURIComponent(code)}`);
      const calls: unknown = await response.json();
      if (!isRecordedCallList(calls)) {
        throw new Error("The OFF mock answered calls in an unexpected shape");
      }
      return calls;
    },
    async registerSearch(search) {
      await send("/__mock/register-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(search),
      });
    },
    async searchCalls(searchTerms) {
      const response = await send(`/__mock/calls?searchTerms=${encodeURIComponent(searchTerms)}`);
      const calls: unknown = await response.json();
      if (!isRecordedSearchCallList(calls)) {
        throw new Error("The OFF mock answered search calls in an unexpected shape");
      }
      return calls;
    },
    async reset() {
      await send("/__mock/reset", { method: "POST" });
    },
  };
}

/** The mock the global setup started, for the test files. */
export const offMock = createOffMockClient(`http://127.0.0.1:${offMockPort}`);
