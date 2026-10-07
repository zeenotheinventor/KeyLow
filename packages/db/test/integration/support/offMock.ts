// The test side of the Open Food Facts mock: how a test registers a product and reads back the
// requests the function made. The server itself is in offMockServer.ts and runs in the global setup.

/** The host port the function container reaches as `host.docker.internal:54399` (see .env.test). */
export const offMockPort = 54399;

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

export type RecordedCall = {
  code: string;
  query: Record<string, string>;
  /** Lower-case header names, as Node reports them. */
  headers: Record<string, string>;
};

export type OffMockClient = {
  register: (product: RegisterProduct) => Promise<void>;
  calls: (code: string) => Promise<RecordedCall[]>;
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
    async reset() {
      await send("/__mock/reset", { method: "POST" });
    },
  };
}

/** The mock the global setup started, for the test files. */
export const offMock = createOffMockClient(`http://127.0.0.1:${offMockPort}`);
