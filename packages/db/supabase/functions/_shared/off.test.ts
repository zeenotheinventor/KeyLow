import { assertEquals } from "@std/assert";

import { offRequest } from "./off.ts";

const options = { functionName: "off-search", fields: ["code", "product_name"] };

// Runs `body` with `fetch` answering as given, the User-Agent set and the console quiet. The console
// lines are returned so a test can read what was reported.
async function withOffAnswering(answer: Response, body: () => Promise<void>): Promise<string[]> {
  const realFetch = globalThis.fetch;
  const realConsoleError = console.error;
  const realUserAgent = Deno.env.get("OFF_USER_AGENT");
  const lines: string[] = [];
  globalThis.fetch = () => Promise.resolve(answer);
  console.error = (...parts: unknown[]) => {
    lines.push(parts.map(String).join(" "));
  };
  Deno.env.set("OFF_USER_AGENT", "KeyLow test (test@example.com)");
  try {
    await body();
  } finally {
    globalThis.fetch = realFetch;
    console.error = realConsoleError;
    if (realUserAgent === undefined) {
      Deno.env.delete("OFF_USER_AGENT");
    } else {
      Deno.env.set("OFF_USER_AGENT", realUserAgent);
    }
  }
  return lines;
}

async function failureOf(answer: Response) {
  let result: Awaited<ReturnType<typeof offRequest>> | undefined;
  const lines = await withOffAnswering(answer, async () => {
    result = await offRequest("/cgi/search.pl", options);
  });
  if (result === undefined || result.ok) {
    throw new Error("Expected offRequest to fail");
  }
  return { response: result.failure, lines };
}

Deno.test(
  "offRequest answers rate_limited with the wait when Open Food Facts answers 429 with a whole-number Retry-After",
  async () => {
    const { response, lines } = await failureOf(
      new Response(null, { status: 429, headers: { "Retry-After": "42" } }),
    );

    assertEquals(response.status, 429);
    assertEquals(response.headers.get("Retry-After"), "42");
    const body = await response.json();
    assertEquals(body.error.code, "rate_limited");
    assertEquals(body.error.retryAfterSeconds, 42);
    assertEquals(lines.length, 1);
    assertEquals(lines[0].startsWith("off-search rate_limited"), true);
  },
);

Deno.test(
  "offRequest answers rate_limited without a wait when Open Food Facts sends no Retry-After",
  async () => {
    const { response } = await failureOf(new Response(null, { status: 429 }));

    assertEquals(response.status, 429);
    assertEquals(response.headers.get("Retry-After"), null);
    const body = await response.json();
    assertEquals(body.error.code, "rate_limited");
    assertEquals("retryAfterSeconds" in body.error, false);
  },
);

Deno.test("offRequest ignores a Retry-After that is not a whole number of seconds", async () => {
  for (const value of [
    "Wed, 21 Oct 2026 07:28:00 GMT",
    "1.5",
    "-3",
    "0",
    "soon",
    "",
    "99999999999999999999",
  ]) {
    const { response } = await failureOf(
      new Response(null, { status: 429, headers: { "Retry-After": value } }),
    );

    assertEquals(response.status, 429);
    assertEquals(response.headers.get("Retry-After"), null, value);
    assertEquals("retryAfterSeconds" in (await response.json()).error, false, value);
  }
});

Deno.test("offRequest keeps answering upstream_error for any other error status", async () => {
  const { response, lines } = await failureOf(new Response(null, { status: 503 }));

  assertEquals(response.status, 502);
  assertEquals((await response.json()).error.code, "upstream_error");
  assertEquals(lines[0].startsWith("off-search upstream_error"), true);
});

Deno.test(
  "offRequest hands back a 429 the caller accepts instead of answering rate_limited",
  async () => {
    let result: Awaited<ReturnType<typeof offRequest>> | undefined;
    const lines = await withOffAnswering(
      new Response(null, { status: 429, headers: { "Retry-After": "42" } }),
      async () => {
        result = await offRequest("/cgi/search.pl", { ...options, acceptedStatuses: [429] });
      },
    );

    assertEquals(result?.ok, true);
    assertEquals(result?.ok ? result.response.status : undefined, 429);
    assertEquals(lines, []);
  },
);
