import { assertEquals } from "@std/assert";

import { fetchRecipePage } from "./recipePage.ts";

import type { RecipePageDependencies } from "./recipePage.ts";

const publicIpv4 = "93.184.216.34";
const publicIpv6 = "2606:2800:220:1:248:1893:25c8:1946";
const testUserAgent = "KeyLow-test/0.0 (test@keylow.local)";
const mebibyte = 1024 * 1024;
const htmlHeaders = { "content-type": "text/html; charset=utf-8" };

type FetchCall = { url: string; init: RequestInit };
type DnsCall = [hostname: string, recordType: string];

type Harness = {
  dependencies: RecipePageDependencies;
  fetchCalls: FetchCall[];
  dnsCalls: DnsCall[];
};

type HarnessOptions = {
  respond?: (call: FetchCall, callNumber: number) => Response | Promise<Response>;
  addresses?: Record<string, { A?: string[]; AAAA?: string[] }>;
  timeoutMilliseconds?: number;
};

// A fetch and a resolver that never touch the network. A host the test does not list resolves to
// one public IPv4 address and no IPv6 address.
function harness(options: HarnessOptions = {}): Harness {
  const fetchCalls: FetchCall[] = [];
  const dnsCalls: DnsCall[] = [];
  const respond = options.respond ?? (() => new Response("<p>hello</p>", { headers: htmlHeaders }));
  return {
    fetchCalls,
    dnsCalls,
    dependencies: {
      fetchPage: (url, init) => {
        fetchCalls.push({ url: String(url), init });
        return Promise.resolve(respond({ url: String(url), init }, fetchCalls.length));
      },
      resolveDns: (hostname, recordType) => {
        dnsCalls.push([hostname, recordType]);
        const listed = options.addresses?.[hostname] ?? { A: [publicIpv4] };
        return Promise.resolve(listed[recordType] ?? []);
      },
      readUserAgent: () => testUserAgent,
      timeoutMilliseconds: options.timeoutMilliseconds ?? 10_000,
    },
  };
}

function redirectTo(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

// Reads the body in chunks of `chunkBytes` for as long as the caller keeps pulling.
function endlessBody(chunkBytes: number, counters: { pulled: number; cancelled: boolean }) {
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      counters.pulled += 1;
      controller.enqueue(new Uint8Array(chunkBytes).fill(97));
    },
    cancel() {
      counters.cancelled = true;
    },
  });
}

Deno.test("a public page answers its html and its final address", async () => {
  const { dependencies, fetchCalls } = harness();

  const result = await fetchRecipePage("https://recipes.example/soup?x=1#top", dependencies);

  assertEquals(result, {
    ok: true,
    html: "<p>hello</p>",
    finalUrl: "https://recipes.example/soup?x=1#top",
  });
  assertEquals(fetchCalls.length, 1);
});

Deno.test(
  "the request carries the Ki-Lo User-Agent, asks for html and never follows redirects itself",
  async () => {
    const { dependencies, fetchCalls } = harness();

    await fetchRecipePage("https://recipes.example/soup", dependencies);

    const headers = new Headers(fetchCalls[0].init.headers);
    assertEquals(headers.get("user-agent"), testUserAgent);
    assertEquals(headers.get("accept")?.startsWith("text/html"), true);
    assertEquals(fetchCalls[0].init.redirect, "manual");
    assertEquals(fetchCalls[0].init.method, "GET");
  },
);

Deno.test(
  "the User-Agent defaults to OFF_USER_AGENT, as the Open Food Facts proxy does",
  async () => {
    const { dependencies, fetchCalls } = harness();
    const { readUserAgent: _unused, ...withoutUserAgent } = dependencies;
    const previous = Deno.env.get("OFF_USER_AGENT");
    try {
      Deno.env.set("OFF_USER_AGENT", "KeyLow-env/1.0 (env@keylow.local)");
      await fetchRecipePage("https://recipes.example/soup", withoutUserAgent);
      assertEquals(
        new Headers(fetchCalls[0].init.headers).get("user-agent"),
        "KeyLow-env/1.0 (env@keylow.local)",
      );

      Deno.env.delete("OFF_USER_AGENT");
      const before = fetchCalls.length;
      let thrown: unknown;
      await fetchRecipePage("https://recipes.example/soup", withoutUserAgent).catch((caught) => {
        thrown = caught;
      });
      assertEquals(thrown instanceof Error, true);
      assertEquals(fetchCalls.length, before);
    } finally {
      if (previous === undefined) {
        Deno.env.delete("OFF_USER_AGENT");
      } else {
        Deno.env.set("OFF_USER_AGENT", previous);
      }
    }
  },
);

Deno.test("only http and https addresses are fetched", async () => {
  for (const url of [
    "ftp://recipes.example/a",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "data:text/html,<p>x</p>",
    "gopher://recipes.example/",
    "not a url",
    "",
    "//recipes.example/a",
  ]) {
    const { dependencies, fetchCalls, dnsCalls } = harness();

    assertEquals(
      await fetchRecipePage(url, dependencies),
      { ok: false, code: "blocked_address" },
      url,
    );
    assertEquals(fetchCalls.length + dnsCalls.length, 0, url);
  }
});

Deno.test("http is fetched as well as https", async () => {
  const { dependencies } = harness();

  assertEquals((await fetchRecipePage("http://recipes.example/a", dependencies)).ok, true);
});

Deno.test("an address with credentials in it is refused before any lookup", async () => {
  for (const url of [
    "https://user:pass@recipes.example/a",
    "https://user@recipes.example/a",
    "https://:pass@recipes.example/a",
  ]) {
    const { dependencies, fetchCalls, dnsCalls } = harness();

    assertEquals(
      await fetchRecipePage(url, dependencies),
      { ok: false, code: "blocked_address" },
      url,
    );
    assertEquals(fetchCalls.length + dnsCalls.length, 0, url);
  }
});

// Each row is an address in a class that must never be fetched: the class, then a sample.
const blockedAddressLiterals: [string, string][] = [
  ["IPv4 this network", "0.0.0.0"],
  ["IPv4 this network", "0.1.2.3"],
  ["IPv4 private 10/8", "10.0.0.1"],
  ["IPv4 carrier-grade NAT", "100.64.0.1"],
  ["IPv4 carrier-grade NAT, Alibaba metadata", "100.100.100.200"],
  ["IPv4 loopback", "127.0.0.1"],
  ["IPv4 loopback", "127.255.255.254"],
  ["IPv4 link-local, cloud metadata", "169.254.169.254"],
  ["IPv4 link-local", "169.254.0.1"],
  ["IPv4 private 172.16/12", "172.16.0.1"],
  ["IPv4 private 172.16/12", "172.31.255.255"],
  ["IPv4 IETF protocol assignments, Oracle metadata", "192.0.0.192"],
  ["IPv4 documentation", "192.0.2.1"],
  ["IPv4 private 192.168/16", "192.168.1.1"],
  ["IPv4 benchmarking", "198.18.0.1"],
  ["IPv4 benchmarking", "198.19.255.255"],
  ["IPv4 documentation", "198.51.100.1"],
  ["IPv4 documentation", "203.0.113.1"],
  ["IPv4 multicast", "224.0.0.1"],
  ["IPv4 reserved", "240.0.0.1"],
  ["IPv4 broadcast", "255.255.255.255"],
  ["IPv6 unspecified", "[::]"],
  ["IPv6 loopback", "[::1]"],
  ["IPv6 IPv4-compatible", "[::7f00:1]"],
  ["IPv6 IPv4-mapped loopback", "[::ffff:127.0.0.1]"],
  ["IPv6 IPv4-mapped private", "[::ffff:10.1.2.3]"],
  ["IPv6 IPv4-mapped metadata", "[::ffff:169.254.169.254]"],
  ["IPv6 NAT64 of a private address", "[64:ff9b::a00:1]"],
  ["IPv6 NAT64 of metadata", "[64:ff9b::169.254.169.254]"],
  ["IPv6 6to4 of a private address", "[2002:c0a8:101::1]"],
  ["IPv6 unique local", "[fc00::1]"],
  ["IPv6 unique local, AWS metadata", "[fd00:ec2::254]"],
  ["IPv6 link-local", "[fe80::1]"],
  ["IPv6 site-local", "[fec0::1]"],
  ["IPv6 multicast", "[ff02::1]"],
  ["IPv6 documentation", "[2001:db8::1]"],
  ["IPv6 Teredo", "[2001::1]"],
  ["IPv6 discard", "[100::1]"],
];

Deno.test(
  "each blocked class of IPv4 and IPv6 address is refused as a literal, with no lookup",
  async () => {
    for (const [label, host] of blockedAddressLiterals) {
      const { dependencies, fetchCalls, dnsCalls } = harness();

      const result = await fetchRecipePage(`http://${host}/recipe`, dependencies);

      assertEquals(result, { ok: false, code: "blocked_address" }, `${label}: ${host}`);
      assertEquals(fetchCalls.length + dnsCalls.length, 0, `${label}: ${host}`);
    }
  },
);

Deno.test(
  "odd spellings of loopback are refused because the address is normalised first",
  async () => {
    for (const url of [
      "http://2130706433/",
      "http://0x7f.0.0.1/",
      "http://0177.0.0.1/",
      "http://127.1/",
      "http://[0:0:0:0:0:0:0:1]/",
      "http://[::ffff:7f00:1]/",
    ]) {
      const { dependencies, fetchCalls } = harness();

      assertEquals(
        await fetchRecipePage(url, dependencies),
        { ok: false, code: "blocked_address" },
        url,
      );
      assertEquals(fetchCalls.length, 0, url);
    }
  },
);

Deno.test("public IPv4 and IPv6 literals next to the blocked ranges are fetched", async () => {
  for (const host of [
    "8.8.8.8",
    "172.15.255.255",
    "172.32.0.1",
    "100.63.255.255",
    "100.128.0.1",
    "169.253.0.1",
    "[2606:2800:220:1::1]",
    "[::ffff:8.8.8.8]",
    "[2002:808:808::1]",
    "[64:ff9b::808:808]",
  ]) {
    const { dependencies, dnsCalls } = harness();

    const result = await fetchRecipePage(`https://${host}/recipe`, dependencies);

    assertEquals(result.ok, true, host);
    assertEquals(dnsCalls.length, 0, host);
  }
});

Deno.test(
  "a host name that resolves to a blocked address is refused, on either record type",
  async () => {
    const cases: [string, { A?: string[]; AAAA?: string[] }][] = [
      ["private IPv4", { A: ["10.0.0.5"] }],
      ["loopback IPv4", { A: ["127.0.0.1"] }],
      ["metadata IPv4", { A: ["169.254.169.254"] }],
      ["loopback IPv6", { AAAA: ["::1"] }],
      ["unique local IPv6", { AAAA: ["fd12:3456::1"] }],
      ["mapped private IPv6", { AAAA: ["::ffff:192.168.0.9"] }],
      ["public and private IPv4", { A: [publicIpv4, "10.0.0.5"] }],
      ["public IPv4 and private IPv6", { A: [publicIpv4], AAAA: ["fe80::1"] }],
      ["private IPv4 first", { A: ["10.0.0.5", publicIpv4] }],
      ["an answer that is not an address", { A: ["not-an-address"] }],
    ];
    for (const [label, records] of cases) {
      const { dependencies, fetchCalls } = harness({ addresses: { "recipes.example": records } });

      assertEquals(
        await fetchRecipePage("https://recipes.example/a", dependencies),
        { ok: false, code: "blocked_address" },
        label,
      );
      assertEquals(fetchCalls.length, 0, label);
    }
  },
);

Deno.test("localhost and the metadata name are refused through their addresses", async () => {
  const { dependencies, fetchCalls } = harness({
    addresses: {
      localhost: { A: ["127.0.0.1"], AAAA: ["::1"] },
      "metadata.google.internal": { A: ["169.254.169.254"] },
    },
  });

  assertEquals(await fetchRecipePage("http://localhost:54321/rest/v1/", dependencies), {
    ok: false,
    code: "blocked_address",
  });
  assertEquals(
    await fetchRecipePage("http://metadata.google.internal/computeMetadata/v1/", dependencies),
    { ok: false, code: "blocked_address" },
  );
  assertEquals(fetchCalls.length, 0);
});

Deno.test("both A and AAAA records of the host are looked up", async () => {
  const { dependencies, dnsCalls } = harness({
    addresses: { "recipes.example": { A: [publicIpv4], AAAA: [publicIpv6] } },
  });

  assertEquals((await fetchRecipePage("https://recipes.example/a", dependencies)).ok, true);
  assertEquals(dnsCalls.map(([, recordType]) => recordType).sort(), ["A", "AAAA"]);
});

Deno.test(
  "a host that does not resolve, or whose lookup fails, is an http_error and nothing is fetched",
  async () => {
    const unresolved = harness({ addresses: { "nowhere.example": {} } });
    assertEquals(await fetchRecipePage("https://nowhere.example/a", unresolved.dependencies), {
      ok: false,
      code: "http_error",
    });
    assertEquals(unresolved.fetchCalls.length, 0);

    const failing = harness();
    failing.dependencies.resolveDns = (_hostname, recordType) =>
      recordType === "A"
        ? Promise.resolve([publicIpv4])
        : Promise.reject(new Error("resolver down"));
    assertEquals(await fetchRecipePage("https://recipes.example/a", failing.dependencies), {
      ok: false,
      code: "http_error",
    });
    assertEquals(failing.fetchCalls.length, 0);
  },
);

Deno.test(
  "a record type the host has none of is not an error when the other type resolves",
  async () => {
    const { dependencies } = harness();
    dependencies.resolveDns = (_hostname, recordType) =>
      recordType === "A"
        ? Promise.resolve([publicIpv4])
        : Promise.reject(new Deno.errors.NotFound("no AAAA"));

    assertEquals((await fetchRecipePage("https://recipes.example/a", dependencies)).ok, true);
  },
);

Deno.test("a redirect is followed manually and answers the final address", async () => {
  const { dependencies, fetchCalls } = harness({
    respond: (_call, callNumber) =>
      callNumber === 1
        ? redirectTo("/moved/soup")
        : new Response("<p>moved</p>", { headers: htmlHeaders }),
  });

  const result = await fetchRecipePage("https://recipes.example/old", dependencies);

  assertEquals(result, {
    ok: true,
    html: "<p>moved</p>",
    finalUrl: "https://recipes.example/moved/soup",
  });
  assertEquals(
    fetchCalls.map((call) => call.url),
    ["https://recipes.example/old", "https://recipes.example/moved/soup"],
  );
});

Deno.test(
  "every redirect status is followed and a cross-host redirect is looked up again",
  async () => {
    for (const status of [301, 302, 303, 307, 308]) {
      const { dependencies, dnsCalls } = harness({
        respond: (_call, callNumber) =>
          callNumber === 1
            ? redirectTo("https://other.example/b", status)
            : new Response("ok", { headers: htmlHeaders }),
      });

      const result = await fetchRecipePage("https://recipes.example/a", dependencies);

      assertEquals(result.ok && result.finalUrl, "https://other.example/b", String(status));
      assertEquals(
        dnsCalls.some(([hostname]) => hostname === "other.example"),
        true,
        String(status),
      );
    }
  },
);

Deno.test(
  "a redirect to a private address is refused and that address is never fetched",
  async () => {
    for (const location of [
      "http://127.0.0.1/admin",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]/",
      "http://[fd00:ec2::254]/",
      "http://internal.example/",
    ]) {
      const { dependencies, fetchCalls } = harness({
        addresses: {
          "internal.example": { A: ["10.0.0.9"] },
          "recipes.example": { A: [publicIpv4] },
        },
        respond: () => redirectTo(location),
      });

      const result = await fetchRecipePage("https://recipes.example/a", dependencies);

      assertEquals(result, { ok: false, code: "blocked_address" }, location);
      assertEquals(
        fetchCalls.map((call) => call.url),
        ["https://recipes.example/a"],
        location,
      );
    }
  },
);

Deno.test("a redirect to another scheme, or with credentials, is refused", async () => {
  for (const location of [
    "ftp://recipes.example/a",
    "file:///etc/passwd",
    "https://user:pass@recipes.example/a",
  ]) {
    const { dependencies, fetchCalls } = harness({ respond: () => redirectTo(location) });

    assertEquals(
      await fetchRecipePage("https://recipes.example/a", dependencies),
      { ok: false, code: "blocked_address" },
      location,
    );
    assertEquals(fetchCalls.length, 1, location);
  }
});

Deno.test("three redirects are followed and a fourth is an http_error", async () => {
  const chain = harness({
    respond: (_call, callNumber) =>
      callNumber <= 3
        ? redirectTo(`/hop${callNumber}`)
        : new Response("<p>arrived</p>", { headers: htmlHeaders }),
  });
  assertEquals(await fetchRecipePage("https://recipes.example/start", chain.dependencies), {
    ok: true,
    html: "<p>arrived</p>",
    finalUrl: "https://recipes.example/hop3",
  });

  const tooMany = harness({ respond: (_call, callNumber) => redirectTo(`/hop${callNumber}`) });
  assertEquals(await fetchRecipePage("https://recipes.example/start", tooMany.dependencies), {
    ok: false,
    code: "http_error",
  });
  assertEquals(tooMany.fetchCalls.length, 4);
});

Deno.test("a redirect with no Location is an http_error", async () => {
  const { dependencies } = harness({ respond: () => new Response(null, { status: 302 }) });

  assertEquals(await fetchRecipePage("https://recipes.example/a", dependencies), {
    ok: false,
    code: "http_error",
  });
});

Deno.test("a status other than success is an http_error", async () => {
  for (const status of [400, 401, 403, 404, 410, 429, 500, 503]) {
    const { dependencies } = harness({
      respond: () => new Response("<p>no</p>", { status, headers: htmlHeaders }),
    });

    assertEquals(
      await fetchRecipePage("https://recipes.example/a", dependencies),
      { ok: false, code: "http_error" },
      String(status),
    );
  }
});

Deno.test("a fetch that fails is an http_error", async () => {
  const { dependencies } = harness({
    respond: () => {
      throw new TypeError("connection refused");
    },
  });

  assertEquals(await fetchRecipePage("https://recipes.example/a", dependencies), {
    ok: false,
    code: "http_error",
  });
});

Deno.test("only text/html is read, whatever its case or parameters", async () => {
  for (const contentType of [
    "application/json",
    "text/plain",
    "application/xhtml+xml",
    "application/pdf",
    "image/png",
    "text/htmlx",
  ]) {
    const { dependencies } = harness({
      respond: () => new Response("x", { headers: { "content-type": contentType } }),
    });

    assertEquals(
      await fetchRecipePage("https://recipes.example/a", dependencies),
      { ok: false, code: "not_html" },
      contentType,
    );
  }
  const missing = harness({ respond: () => new Response(new Uint8Array([120])) });
  assertEquals(await fetchRecipePage("https://recipes.example/a", missing.dependencies), {
    ok: false,
    code: "not_html",
  });

  for (const contentType of [
    "text/html",
    "TEXT/HTML; charset=ISO-8859-1",
    " text/html ;charset=utf-8",
  ]) {
    const { dependencies } = harness({
      respond: () => new Response("<p>x</p>", { headers: { "content-type": contentType } }),
    });

    assertEquals(
      (await fetchRecipePage("https://recipes.example/a", dependencies)).ok,
      true,
      contentType,
    );
  }
});

Deno.test("a body of exactly 2 MiB is read and one byte more is too_large", async () => {
  const exact = harness({
    respond: () => new Response("a".repeat(2 * mebibyte), { headers: htmlHeaders }),
  });
  const exactResult = await fetchRecipePage("https://recipes.example/a", exact.dependencies);
  assertEquals(exactResult.ok && exactResult.html.length, 2 * mebibyte);

  const over = harness({
    respond: () => new Response("a".repeat(2 * mebibyte + 1), { headers: htmlHeaders }),
  });
  assertEquals(await fetchRecipePage("https://recipes.example/a", over.dependencies), {
    ok: false,
    code: "too_large",
  });
});

Deno.test("reading stops at the cap even when the page never ends", async () => {
  const counters = { pulled: 0, cancelled: false };
  const { dependencies } = harness({
    respond: () => new Response(endlessBody(256 * 1024, counters), { headers: htmlHeaders }),
  });

  assertEquals(await fetchRecipePage("https://recipes.example/a", dependencies), {
    ok: false,
    code: "too_large",
  });
  assertEquals(counters.cancelled, true);
  assertEquals(counters.pulled <= 10, true, `pulled ${counters.pulled} chunks`);
});

Deno.test("a Content-Length over the cap is too_large before any of the body is read", async () => {
  const counters = { pulled: 0, cancelled: false };
  const { dependencies } = harness({
    respond: () =>
      new Response(endlessBody(1024, counters), {
        headers: { ...htmlHeaders, "content-length": String(2 * mebibyte + 1) },
      }),
  });

  assertEquals(await fetchRecipePage("https://recipes.example/a", dependencies), {
    ok: false,
    code: "too_large",
  });
  // A stream pulls once by itself when it is made, so one pull is not a read.
  assertEquals(counters.pulled <= 1, true);
  assertEquals(counters.cancelled, true);
});

Deno.test(
  "a body in several chunks is joined and decoded as UTF-8 across chunk edges",
  async () => {
    const bytes = new TextEncoder().encode("<p>café \u{1f95a}</p>");
    const { dependencies } = harness({
      respond: () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              for (let index = 0; index < bytes.length; index += 1) {
                controller.enqueue(bytes.slice(index, index + 1));
              }
              controller.close();
            },
          }),
          { headers: htmlHeaders },
        ),
    });

    const result = await fetchRecipePage("https://recipes.example/a", dependencies);

    assertEquals(result.ok && result.html, "<p>café \u{1f95a}</p>");
  },
);

Deno.test("an empty body is an empty page", async () => {
  const { dependencies } = harness({ respond: () => new Response(null, { headers: htmlHeaders }) });

  assertEquals(await fetchRecipePage("https://recipes.example/a", dependencies), {
    ok: true,
    html: "",
    finalUrl: "https://recipes.example/a",
  });
});

Deno.test("a server that never answers times out and the request is aborted", async () => {
  let aborted = false;
  const { dependencies } = harness({
    timeoutMilliseconds: 20,
    respond: ({ init }) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(init.signal?.reason);
        });
      }),
  });

  assertEquals(await fetchRecipePage("https://recipes.example/a", dependencies), {
    ok: false,
    code: "timeout",
  });
  assertEquals(aborted, true);
});

Deno.test("a body that stalls part-way through times out", async () => {
  const { dependencies } = harness({
    timeoutMilliseconds: 20,
    respond: ({ init }) =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("<p>half"));
            init.signal?.addEventListener("abort", () => controller.error(init.signal?.reason));
          },
        }),
        { headers: htmlHeaders },
      ),
  });

  assertEquals(await fetchRecipePage("https://recipes.example/a", dependencies), {
    ok: false,
    code: "timeout",
  });
});

Deno.test("the timeout is one budget for every hop, not one per hop", async () => {
  const { dependencies, fetchCalls } = harness({
    timeoutMilliseconds: 60,
    respond: async ({ init }, callNumber) => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      if (init.signal?.aborted) {
        throw init.signal.reason;
      }
      return callNumber < 3
        ? redirectTo(`/hop${callNumber}`)
        : new Response("late", { headers: htmlHeaders });
    },
  });

  assertEquals(await fetchRecipePage("https://recipes.example/a", dependencies), {
    ok: false,
    code: "timeout",
  });
  assertEquals(fetchCalls.length <= 2, true);
});

Deno.test("fetchRecipePage logs nothing", async () => {
  const written: unknown[][] = [];
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };
  const capture = (...args: unknown[]) => {
    written.push(args);
  };
  Object.assign(console, {
    log: capture,
    info: capture,
    warn: capture,
    error: capture,
    debug: capture,
  });
  try {
    await fetchRecipePage("https://recipes.example/a", harness().dependencies);
    await fetchRecipePage("http://10.0.0.1/a", harness().dependencies);
    await fetchRecipePage(
      "https://recipes.example/a",
      harness({ respond: () => new Response("x", { status: 500 }) }).dependencies,
    );
  } finally {
    Object.assign(console, original);
  }

  assertEquals(written, []);
});

Deno.test("only the default port, 80 and 443 are fetched", async () => {
  for (const url of [
    "https://recipes.example/a",
    "http://recipes.example/a",
    "https://recipes.example:443/a",
    "http://recipes.example:80/a",
    "http://recipes.example:443/a",
    "https://recipes.example:80/a",
    "https://8.8.8.8:443/a",
  ]) {
    const { dependencies } = harness();

    assertEquals((await fetchRecipePage(url, dependencies)).ok, true, url);
  }
  for (const url of [
    "http://recipes.example:8080/a",
    "https://recipes.example:8443/a",
    "http://recipes.example:22/",
    "http://recipes.example:5432/",
    "http://recipes.example:54321/rest/v1/",
    "http://recipes.example:0/",
    "https://8.8.8.8:6379/",
    "http://[2606:2800:220:1::1]:9200/",
  ]) {
    const { dependencies, fetchCalls, dnsCalls } = harness();

    assertEquals(
      await fetchRecipePage(url, dependencies),
      { ok: false, code: "blocked_address" },
      url,
    );
    assertEquals(fetchCalls.length + dnsCalls.length, 0, url);
  }
});

Deno.test("a redirect to another port is refused and that port is never fetched", async () => {
  for (const location of ["http://recipes.example:8080/admin", "https://other.example:8443/"]) {
    const { dependencies, fetchCalls } = harness({ respond: () => redirectTo(location) });

    assertEquals(
      await fetchRecipePage("https://recipes.example/a", dependencies),
      { ok: false, code: "blocked_address" },
      location,
    );
    assertEquals(fetchCalls.length, 1, location);
  }
});

Deno.test("the resolver is given the abort signal of the fetch", async () => {
  const { dependencies } = harness();
  const signals: unknown[] = [];
  dependencies.resolveDns = (_hostname, _recordType, options) => {
    signals.push(options.signal);
    return Promise.resolve([publicIpv4]);
  };

  await fetchRecipePage("https://recipes.example/a", dependencies);

  assertEquals(signals.length, 2);
  assertEquals(
    signals.every((signal) => signal instanceof AbortSignal),
    true,
  );
});

Deno.test(
  "a resolver that never answers times out inside the same budget and nothing is fetched",
  async () => {
    const { dependencies, fetchCalls } = harness({ timeoutMilliseconds: 20 });
    const signals: AbortSignal[] = [];
    dependencies.resolveDns = (_hostname, _recordType, options) => {
      signals.push(options.signal);
      return new Promise<string[]>(() => {});
    };

    assertEquals(await fetchRecipePage("https://recipes.example/a", dependencies), {
      ok: false,
      code: "timeout",
    });
    assertEquals(fetchCalls.length, 0);
    assertEquals(signals.length > 0 && signals.every((signal) => signal.aborted), true);
  },
);

Deno.test("the timeout timer is cleared when the fetch ends, whichever way it ends", async () => {
  const budget = 12_345;
  const started = new Map<unknown, number>();
  const cleared = new Set<unknown>();
  const { setTimeout: realSetTimeout, clearTimeout: realClearTimeout } = globalThis;
  Object.assign(globalThis, {
    setTimeout: (handler: () => void, delay?: number) => {
      const id = realSetTimeout(handler, delay);
      started.set(id, delay ?? 0);
      return id;
    },
    clearTimeout: (id?: unknown) => {
      if (id !== undefined) {
        cleared.add(id);
      }
      realClearTimeout(typeof id === "number" ? id : undefined);
    },
  });
  try {
    for (const url of [
      "https://recipes.example/a",
      "http://10.0.0.1/a",
      "ftp://recipes.example/a",
    ]) {
      started.clear();
      cleared.clear();
      const { dependencies } = harness({ timeoutMilliseconds: budget });

      await fetchRecipePage(url, dependencies);

      const ours = [...started].filter(([, delay]) => delay === budget).map(([id]) => id);
      assertEquals(ours.length, 1, url);
      assertEquals(cleared.has(ours[0]), true, url);
    }
  } finally {
    Object.assign(globalThis, { setTimeout: realSetTimeout, clearTimeout: realClearTimeout });
  }
});
