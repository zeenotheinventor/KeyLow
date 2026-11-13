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
    result = await offRequest("/search", options);
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
    assertEquals(lines[0].startsWith("report function=off-search code=rate_limited"), true);
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
  assertEquals(lines[0].startsWith("report function=off-search code=upstream_error"), true);
});

Deno.test(
  "offRequest hands back a 429 the caller accepts instead of answering rate_limited",
  async () => {
    let result: Awaited<ReturnType<typeof offRequest>> | undefined;
    const lines = await withOffAnswering(
      new Response(null, { status: 429, headers: { "Retry-After": "42" } }),
      async () => {
        result = await offRequest("/search", { ...options, acceptedStatuses: [429] });
      },
    );

    assertEquals(result?.ok, true);
    assertEquals(result?.ok ? result.response.status : undefined, 429);
    assertEquals(lines, []);
  },
);

// Runs `body` with `fetch` recording the URL it was asked for, and OFF_BASE_URL set as given
// (unset when undefined).
async function withRecordedUrl(
  baseUrlVariable: string | undefined,
  body: () => Promise<void>,
): Promise<string[]> {
  const realFetch = globalThis.fetch;
  const realBaseUrl = Deno.env.get("OFF_BASE_URL");
  const realUserAgent = Deno.env.get("OFF_USER_AGENT");
  const urls: string[] = [];
  globalThis.fetch = (input) => {
    urls.push(String(input));
    return Promise.resolve(new Response("{}"));
  };
  Deno.env.set("OFF_USER_AGENT", "KeyLow test (test@example.com)");
  if (baseUrlVariable === undefined) {
    Deno.env.delete("OFF_BASE_URL");
  } else {
    Deno.env.set("OFF_BASE_URL", baseUrlVariable);
  }
  try {
    await body();
  } finally {
    globalThis.fetch = realFetch;
    if (realBaseUrl === undefined) {
      Deno.env.delete("OFF_BASE_URL");
    } else {
      Deno.env.set("OFF_BASE_URL", realBaseUrl);
    }
    if (realUserAgent === undefined) {
      Deno.env.delete("OFF_USER_AGENT");
    } else {
      Deno.env.set("OFF_USER_AGENT", realUserAgent);
    }
  }
  return urls;
}

Deno.test("offRequest uses the baseUrl option when OFF_BASE_URL is not set", async () => {
  const urls = await withRecordedUrl(undefined, async () => {
    await offRequest("/search", { ...options, baseUrl: "https://search.example.test" });
  });

  assertEquals(urls.length, 1);
  assertEquals(urls[0].startsWith("https://search.example.test/search?"), true);
});

Deno.test("offRequest lets OFF_BASE_URL win over the baseUrl option", async () => {
  const urls = await withRecordedUrl("http://mock.example.test:24399", async () => {
    await offRequest("/search", { ...options, baseUrl: "https://search.example.test" });
  });

  assertEquals(urls[0].startsWith("http://mock.example.test:24399/search?"), true);
});

Deno.test(
  "offRequest uses the world site when there is neither OFF_BASE_URL nor a baseUrl",
  async () => {
    const urls = await withRecordedUrl(undefined, async () => {
      await offRequest("/api/v2/product/1", options);
    });

    assertEquals(urls[0].startsWith("https://world.openfoodfacts.org/api/v2/product/1?"), true);
  },
);

Deno.test(
  "offRequest reports nothing for an upstream failure when reportFailures is false",
  async () => {
    let result: Awaited<ReturnType<typeof offRequest>> | undefined;
    const lines = await withOffAnswering(new Response(null, { status: 503 }), async () => {
      result = await offRequest("/search", { ...options, reportFailures: false });
    });

    assertEquals(result?.ok, false);
    assertEquals(result?.ok ? undefined : result?.failure.status, 502);
    assertEquals(lines, []);
  },
);

Deno.test(
  "offRequest reports a network failure only when reportFailures is not false",
  async () => {
    const refuse = () => {
      globalThis.fetch = () => Promise.reject(new TypeError("connection refused"));
    };
    const quiet = await withOffAnswering(new Response(), async () => {
      refuse();
      await offRequest("/search", { ...options, reportFailures: false });
    });
    const loud = await withOffAnswering(new Response(), async () => {
      refuse();
      await offRequest("/search", options);
    });

    assertEquals(quiet, []);
    assertEquals(loud.length, 1);
  },
);

Deno.test(
  "offRequest still reports a 429 when reportFailures is false, because it is never retried",
  async () => {
    const lines = await withOffAnswering(new Response(null, { status: 429 }), async () => {
      await offRequest("/search", { ...options, reportFailures: false });
    });

    assertEquals(lines.length, 1);
    assertEquals(lines[0].startsWith("report function=off-search code=rate_limited"), true);
  },
);

Deno.test("offRequest tells the caller the status Open Food Facts answered with", async () => {
  for (const status of [400, 429, 503]) {
    const { response: _response, upstreamStatus } = await failureWithStatus(
      new Response(null, { status }),
    );

    assertEquals(upstreamStatus, status);
  }
});

Deno.test("offRequest gives no upstream status when there was no answer to read", async () => {
  let result: Awaited<ReturnType<typeof offRequest>> | undefined;
  await withOffAnswering(new Response(), async () => {
    globalThis.fetch = () => Promise.reject(new TypeError("connection refused"));
    result = await offRequest("/search", options);
  });

  assertEquals(result?.ok, false);
  assertEquals(result?.ok ? undefined : result?.upstreamStatus, undefined);
});

async function failureWithStatus(answer: Response) {
  let result: Awaited<ReturnType<typeof offRequest>> | undefined;
  await withOffAnswering(answer, async () => {
    result = await offRequest("/search", options);
  });
  if (result === undefined || result.ok) {
    throw new Error("Expected offRequest to fail");
  }
  return { response: result.failure, upstreamStatus: result.upstreamStatus };
}
