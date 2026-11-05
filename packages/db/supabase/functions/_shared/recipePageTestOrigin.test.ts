import { assertEquals } from "@std/assert";

import { fetchRecipePage } from "./recipePage.ts";
import { RECIPE_PAGE_TEST_HOST, recipePageTestOverrides } from "./recipePageTestOrigin.ts";

import type { RecipePageDependencies } from "./recipePage.ts";

const testOrigin = "http://172.18.0.1:24401";
const localStackUrl = "http://kong:8000";
const publicIpv4 = "93.184.216.34";
const htmlHeaders = { "content-type": "text/html; charset=utf-8" };

type Real = Pick<RecipePageDependencies, "fetchPage" | "resolveDns">;

// The fetch and the resolver the seam falls back to. They record what they were asked and never touch the
// network. A host that the test does not list resolves to one public address.
function realStandIn(addresses: Record<string, string[]> = {}) {
  const fetched: string[] = [];
  const resolved: string[] = [];
  const real: Real = {
    fetchPage: (url) => {
      fetched.push(String(url));
      return Promise.resolve(new Response("<p>real</p>", { headers: htmlHeaders }));
    },
    resolveDns: (hostname, recordType) => {
      resolved.push(`${hostname} ${recordType}`);
      return Promise.resolve(recordType === "A" ? (addresses[hostname] ?? [publicIpv4]) : []);
    },
  };
  return { real, fetched, resolved };
}

const environment =
  (values: Record<string, string>) =>
  (name: string): string | undefined =>
    values[name];

const activeEnvironment = environment({
  RECIPE_PAGE_TEST_ORIGIN: testOrigin,
  SUPABASE_URL: localStackUrl,
});

async function fetchWith(
  url: string,
  readEnv: (name: string) => string | undefined,
  stand = realStandIn(),
) {
  const result = await fetchRecipePage(url, {
    ...recipePageTestOverrides(readEnv, stand.real),
    readUserAgent: () => "KeyLow-test/0.0 (test@keylow.local)",
  });
  return { result, stand };
}

Deno.test(
  "with RECIPE_PAGE_TEST_ORIGIN unset the seam adds no dependency, so the real fetch and resolver are used",
  () => {
    const stand = realStandIn();
    const overrides = recipePageTestOverrides(
      environment({ SUPABASE_URL: localStackUrl }),
      stand.real,
    );
    // `fetchRecipePage` spreads this over its defaults, which are the real `fetch` and `Deno.resolveDns`.
    // An empty object replaces neither, and the stand-ins were not asked for anything.
    assertEquals(overrides, {});
    assertEquals(stand.fetched, []);
    assertEquals(stand.resolved, []);
  },
);

Deno.test("with the origin empty or not a web address the seam changes nothing", () => {
  for (const origin of ["", "not a url", "ftp://172.18.0.1:24401", "javascript:alert(1)"]) {
    assertEquals(
      recipePageTestOverrides(
        environment({ RECIPE_PAGE_TEST_ORIGIN: origin, SUPABASE_URL: localStackUrl }),
        realStandIn().real,
      ),
      {},
    );
  }
});

Deno.test("a SUPABASE_URL that is not a local stack turns the seam off", () => {
  const notLocal = [
    undefined,
    "",
    "not a url",
    "https://abcdefghij.supabase.co",
    "https://abcdefghij.supabase.co/kong",
    "https://kong.supabase.co",
    "https://localhost.supabase.co",
    "https://kong.example.com",
    "http://kong.evil.com:8000",
    "http://localhost.evil.com",
    "http://127.0.0.1.nip.io",
    "http://xkong:8000",
    "http://kongx:8000",
    "http://kong@evil.com",
    "http://localhost:8000@evil.com",
    "http://evil.com/localhost",
    "http://evil.com?host=kong",
    "http://evil.com#kong",
    "http://127.0.0.2:54321",
    "http://10.0.0.1:54321",
  ];
  for (const supabaseUrl of notLocal) {
    const values: Record<string, string> = { RECIPE_PAGE_TEST_ORIGIN: testOrigin };
    if (supabaseUrl !== undefined) {
      values["SUPABASE_URL"] = supabaseUrl;
    }
    assertEquals(
      recipePageTestOverrides(environment(values), realStandIn().real),
      {},
      `SUPABASE_URL ${String(supabaseUrl)} must not turn the seam on`,
    );
  }
});

Deno.test("the local names of a stack turn the seam on", () => {
  for (const supabaseUrl of [
    "http://kong:8000",
    "http://localhost:54321",
    "http://127.0.0.1:54321",
    "http://KONG:8000",
  ]) {
    const overrides = recipePageTestOverrides(
      environment({ RECIPE_PAGE_TEST_ORIGIN: testOrigin, SUPABASE_URL: supabaseUrl }),
      realStandIn().real,
    );
    assertEquals(Object.keys(overrides).sort(), ["fetchPage", "resolveDns"], supabaseUrl);
  }
});

Deno.test("when active, a page of the test host is read from the test origin", async () => {
  const requested: string[] = [];
  const stand = realStandIn();
  const real: Real = {
    ...stand.real,
    fetchPage: (url) => {
      requested.push(String(url));
      return Promise.resolve(new Response("<p>fixture</p>", { headers: htmlHeaders }));
    },
  };
  const result = await fetchRecipePage(`https://${RECIPE_PAGE_TEST_HOST}/pages/a.html?x=1`, {
    ...recipePageTestOverrides(activeEnvironment, real),
    readUserAgent: () => "KeyLow-test/0.0 (test@keylow.local)",
  });
  assertEquals(requested, [`${testOrigin}/pages/a.html?x=1`]);
  assertEquals(result, {
    ok: true,
    html: "<p>fixture</p>",
    finalUrl: `https://${RECIPE_PAGE_TEST_HOST}/pages/a.html?x=1`,
  });
  // The test host is never looked up for real.
  assertEquals(stand.resolved, []);
});

Deno.test("when active, every other host is still judged by the untouched guard", async () => {
  const refused = [
    "http://127.0.0.1/",
    "http://127.0.0.1:24401/pages/a.html",
    "http://10.0.0.5/",
    "http://172.18.0.1/pages/a.html",
    "http://192.168.1.10/",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "http://[::ffff:10.0.0.1]/",
    "http://2130706433/",
    "http://0x7f.1/",
    // The test host's name with something added, or with credentials or a port, is not the test host.
    `https://${RECIPE_PAGE_TEST_HOST}:8443/pages/a.html`,
    `https://user@${RECIPE_PAGE_TEST_HOST}/pages/a.html`,
    "ftp://recipes.keylow.test/pages/a.html",
  ];
  for (const url of refused) {
    const { result, stand } = await fetchWith(url, activeEnvironment);
    assertEquals(result, { ok: false, code: "blocked_address" }, url);
    assertEquals(stand.fetched, [], url);
  }
});

Deno.test(
  "when active, a host that only looks like the test host is resolved and fetched for real",
  async () => {
    for (const hostname of [
      `${RECIPE_PAGE_TEST_HOST}.evil.com`,
      `evil-${RECIPE_PAGE_TEST_HOST}`,
      "keylow.test",
      "RECIPES.KEYLOW.TEST.example.org",
    ]) {
      // It resolves to a private address, so the guard refuses it.
      const privateStand = realStandIn({ [hostname.toLowerCase()]: ["10.0.0.9"] });
      const privateResult = await fetchWith(
        `https://${hostname}/a`,
        activeEnvironment,
        privateStand,
      );
      assertEquals(privateResult.result, { ok: false, code: "blocked_address" }, hostname);
      assertEquals(privateStand.fetched, [], hostname);
      // It resolves to a public address, so it is fetched at its own address and never at the test origin.
      const publicStand = realStandIn();
      const publicResult = await fetchWith(`https://${hostname}/a`, activeEnvironment, publicStand);
      assertEquals(publicResult.result.ok, true, hostname);
      assertEquals(publicStand.fetched, [`https://${hostname.toLowerCase()}/a`], hostname);
    }
  },
);

Deno.test(
  "when active, a redirect from the test host to a private address is refused",
  async () => {
    const fetched: string[] = [];
    const stand = realStandIn();
    const real: Real = {
      ...stand.real,
      fetchPage: (url) => {
        fetched.push(String(url));
        return Promise.resolve(
          new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }),
        );
      },
    };
    const result = await fetchRecipePage(`https://${RECIPE_PAGE_TEST_HOST}/redirect`, {
      ...recipePageTestOverrides(activeEnvironment, real),
      readUserAgent: () => "KeyLow-test/0.0 (test@keylow.local)",
    });
    assertEquals(result, { ok: false, code: "blocked_address" });
    assertEquals(fetched, [`${testOrigin}/redirect`]);
  },
);

Deno.test(
  "the origin comes from the environment only, never from the address or its parts",
  async () => {
    const requested: string[] = [];
    const stand = realStandIn();
    const real: Real = {
      ...stand.real,
      fetchPage: (url) => {
        requested.push(String(url));
        return Promise.resolve(new Response("<p>fixture</p>", { headers: htmlHeaders }));
      },
    };
    const overrides = recipePageTestOverrides(activeEnvironment, real);
    // An address that tries to name another origin, in its path, query or fragment, stays on the test origin.
    for (const tail of [
      "/http://evil.com/",
      "/..%2f..%2fevil",
      "//evil.com/pages/a.html",
      "/a?origin=http://evil.com",
      "/a#http://evil.com",
    ]) {
      requested.length = 0;
      const result = await fetchRecipePage(`https://${RECIPE_PAGE_TEST_HOST}${tail}`, {
        ...overrides,
        readUserAgent: () => "KeyLow-test/0.0 (test@keylow.local)",
      });
      assertEquals(result.ok, true, tail);
      assertEquals(
        requested.every((address) => address.startsWith(`${testOrigin}/`)),
        true,
        `${tail} was fetched at ${requested.join(",")}`,
      );
    }
    // Headers the fetch sends are the fetch's own, so a header is no way to name an origin.
    const fetchPage = overrides.fetchPage;
    requested.length = 0;
    await fetchPage?.(`https://${RECIPE_PAGE_TEST_HOST}/a`, {
      headers: { "x-recipe-page-test-origin": "http://evil.com" },
    });
    assertEquals(requested, [`${testOrigin}/a`]);
  },
);
