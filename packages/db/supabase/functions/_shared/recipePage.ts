// Fetches a recipe page for the import tool. The address comes from a person's message and the page
// comes from anywhere on the internet, so this is a server-side request forgery surface and every
// limit here is enforced before the next step. Only http and https, no credentials in the address,
// every address the host resolves to must be public (checked again on each redirect hop, which is
// followed here and never by fetch), one 10 second budget for the whole fetch, a 2 MiB cap on the
// body (reading stops there), text/html only, and the Open Food Facts User-Agent.
//
// Nothing is logged: not the address, not the page. The fetch and the DNS resolver are injected so
// tests never touch the network.
//
// Known limit: the name is resolved here and `fetch` resolves it again to connect, so a hostile DNS
// server could answer differently the second time. Deno's `fetch` cannot be told which address to
// use, and the Edge Function runs with no route to Supabase's private network, which narrows what a
// rebinding answer could reach.

import { requireUserAgent } from "./off.ts";

export type RecipePageFailureCode =
  "blocked_address" | "too_large" | "timeout" | "not_html" | "http_error";

export type RecipePageResult =
  { ok: true; html: string; finalUrl: string } | { ok: false; code: RecipePageFailureCode };

export type RecipePageDependencies = {
  fetchPage: (url: string, init: RequestInit) => Promise<Response>;
  // Given the signal of the whole fetch, so a slow lookup spends the same 10 seconds as everything else.
  resolveDns: (
    hostname: string,
    recordType: "A" | "AAAA",
    options: { signal: AbortSignal },
  ) => Promise<string[]>;
  // The Open Food Facts User-Agent. A missing one is a configuration error that throws.
  readUserAgent: () => string;
  timeoutMilliseconds: number;
};

const maximumRedirects = 3;
const maximumBodyBytes = 2 * 1024 * 1024;
const defaultTimeoutMilliseconds = 10_000;
const redirectStatuses = new Set([301, 302, 303, 307, 308]);

const defaultDependencies: RecipePageDependencies = {
  fetchPage: (url, init) => fetch(url, init),
  resolveDns: (hostname, recordType, options) => Deno.resolveDns(hostname, recordType, options),
  readUserAgent: requireUserAgent,
  timeoutMilliseconds: defaultTimeoutMilliseconds,
};

// Which addresses are public. An address that cannot be read counts as not public.

type Ipv4 = readonly [number, number, number, number];
type Ipv6 = readonly [number, number, number, number, number, number, number, number];

const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const hexadecimalGroupPattern = /^[0-9a-f]{1,4}$/;

function parseIpv4(text: string): Ipv4 | null {
  const match = ipv4Pattern.exec(text);
  if (match === null) {
    return null;
  }
  const [a, b, c, d] = match.slice(1).map(Number);
  return [a, b, c, d].every((octet) => octet <= 255) ? [a, b, c, d] : null;
}

function parseIpv6(text: string): Ipv6 | null {
  let address = text.toLowerCase();
  if (address.includes(".")) {
    // A dotted IPv4 tail ("::ffff:10.0.0.1") stands for the last two groups.
    const lastColon = address.lastIndexOf(":");
    const tail = parseIpv4(address.slice(lastColon + 1));
    if (tail === null) {
      return null;
    }
    const high = ((tail[0] << 8) | tail[1]).toString(16);
    const low = ((tail[2] << 8) | tail[3]).toString(16);
    address = `${address.slice(0, lastColon + 1)}${high}:${low}`;
  }
  const halves = address.split("::");
  if (halves.length > 2) {
    return null;
  }
  const groupsOf = (half: string) => (half === "" ? [] : half.split(":"));
  const head = groupsOf(halves[0]);
  const tail = halves.length === 2 ? groupsOf(halves[1]) : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) {
    return null;
  }
  const groups = [...head, ...Array<string>(missing).fill("0"), ...tail];
  if (!groups.every((group) => hexadecimalGroupPattern.test(group))) {
    return null;
  }
  const [a, b, c, d, e, f, g, h] = groups.map((group) => Number.parseInt(group, 16));
  return [a, b, c, d, e, f, g, h];
}

// Ranges that are not on the public internet: [first address, prefix length].
const blockedIpv4Ranges: readonly (readonly [Ipv4, number])[] = [
  [[0, 0, 0, 0], 8], // this network
  [[10, 0, 0, 0], 8], // private
  [[100, 64, 0, 0], 10], // carrier-grade NAT, also Alibaba's metadata address
  [[127, 0, 0, 0], 8], // loopback
  [[169, 254, 0, 0], 16], // link-local, also the cloud metadata address
  [[172, 16, 0, 0], 12], // private
  [[192, 0, 0, 0], 24], // IETF protocol assignments, also Oracle's metadata address
  [[192, 0, 2, 0], 24], // documentation
  [[192, 168, 0, 0], 16], // private
  [[198, 18, 0, 0], 15], // benchmarking
  [[198, 51, 100, 0], 24], // documentation
  [[203, 0, 113, 0], 24], // documentation
  [[224, 0, 0, 0], 4], // multicast
  [[240, 0, 0, 0], 4], // reserved, including the broadcast address
];

function ipv4Number([a, b, c, d]: Ipv4): number {
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

function isPublicIpv4(address: Ipv4): boolean {
  const value = ipv4Number(address);
  return !blockedIpv4Ranges.some(([first, prefixLength]) => {
    const mask = (0xffffffff << (32 - prefixLength)) >>> 0;
    return (value & mask) === (ipv4Number(first) & mask);
  });
}

function ipv4FromGroups(high: number, low: number): Ipv4 {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff];
}

// Only global unicast (2000::/3) can be public. The forms that carry an IPv4 address inside an IPv6
// one (mapped, NAT64, 6to4) are public only when that IPv4 address is.
function isPublicIpv6(groups: Ipv6): boolean {
  const [a, b, c, d, e, f, g, h] = groups;
  const firstFiveAreZero = a === 0 && b === 0 && c === 0 && d === 0 && e === 0;
  if (firstFiveAreZero && f === 0xffff) {
    return isPublicIpv4(ipv4FromGroups(g, h));
  }
  if (a === 0x64 && b === 0xff9b && c === 0 && d === 0 && e === 0 && f === 0) {
    return isPublicIpv4(ipv4FromGroups(g, h));
  }
  if (a === 0x2002) {
    return isPublicIpv4(ipv4FromGroups(b, c));
  }
  if ((a & 0xe000) !== 0x2000) {
    return false;
  }
  const isProtocolAssignment = a === 0x2001 && b < 0x0200; // includes Teredo and benchmarking
  const isDocumentation = (a === 0x2001 && b === 0x0db8) || (a === 0x3fff && b < 0x1000);
  return !isProtocolAssignment && !isDocumentation;
}

function isPublicAddress(text: string): boolean {
  const ipv4 = parseIpv4(text);
  if (ipv4 !== null) {
    return isPublicIpv4(ipv4);
  }
  const ipv6 = parseIpv6(text);
  return ipv6 !== null && isPublicIpv6(ipv6);
}

// Checking an address before each request.

type AddressCheck = "public" | "blocked" | "unresolved";

// The address, or null when it is not one this will fetch: another scheme or port, credentials in
// it, or not an address at all. `URL` has already turned 2130706433, 0x7f.1 and [::ffff:7f00:1] into the
// forms the checks below read.
function parseFetchableUrl(text: string): URL | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const hasCredentials = url.username !== "" || url.password !== "";
  const isWebScheme = url.protocol === "https:" || url.protocol === "http:";
  // `URL` leaves the port empty for the scheme's own default. Any other port is a service that is
  // not a web page, such as a database or an admin console.
  const isWebPort = url.port === "" || url.port === "80" || url.port === "443";
  return isWebScheme && isWebPort && !hasCredentials ? url : null;
}

// The answer of `pending`, or a rejection as soon as the fetch's time is up. A resolver or a fetch
// that ignores the signal still cannot hold the call past its budget.
function withinBudget<T>(pending: Promise<T>, timeUp: Promise<never>): Promise<T> {
  pending.catch(() => {});
  return Promise.race([pending, timeUp]);
}

async function lookUp(
  hostname: string,
  recordType: "A" | "AAAA",
  budget: Budget,
  resolveDns: RecipePageDependencies["resolveDns"],
): Promise<string[] | null> {
  try {
    return await withinBudget(
      resolveDns(hostname, recordType, { signal: budget.signal }),
      budget.timeUp,
    );
  } catch (caught) {
    if (budget.signal.aborted) {
      throw caught;
    }
    // A host with no record of this type is normal. Any other failure leaves part of the answer
    // unseen, so the host is not trusted.
    return caught instanceof Deno.errors.NotFound ? [] : null;
  }
}

type Budget = { signal: AbortSignal; timeUp: Promise<never> };

async function checkHost(
  url: URL,
  budget: Budget,
  resolveDns: RecipePageDependencies["resolveDns"],
): Promise<AddressCheck> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const isLiteral = url.hostname.startsWith("[") || parseIpv4(hostname) !== null;
  if (isLiteral) {
    return isPublicAddress(hostname) ? "public" : "blocked";
  }
  const [ipv4Addresses, ipv6Addresses] = await Promise.all([
    lookUp(hostname, "A", budget, resolveDns),
    lookUp(hostname, "AAAA", budget, resolveDns),
  ]);
  if (ipv4Addresses === null || ipv6Addresses === null) {
    return "unresolved";
  }
  const addresses = [...ipv4Addresses, ...ipv6Addresses];
  if (addresses.length === 0) {
    return "unresolved";
  }
  return addresses.every(isPublicAddress) ? "public" : "blocked";
}

// Reading the answer.

function isHtml(response: Response): boolean {
  const mediaType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  return mediaType === "text/html";
}

function declaredLength(response: Response): number {
  const header = response.headers.get("content-length");
  return header === null || !/^\d+$/.test(header) ? 0 : Number(header);
}

// The body as text, or null once it passes the cap. Reading stops there and the rest is cancelled.
async function readCappedBody(response: Response): Promise<string | null> {
  if (declaredLength(response) > maximumBodyBytes) {
    await response.body?.cancel();
    return null;
  }
  const reader = response.body?.getReader();
  if (reader === undefined) {
    return "";
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maximumBodyBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function failure(code: RecipePageFailureCode): RecipePageResult {
  return { ok: false, code };
}

// Fetches `url` and answers its html and final address, or the reason it did not. A missing
// User-Agent throws before any request, because that is a configuration problem and not a page
// problem. Everything a page or the network can do wrong is an answer, never a throw.
export async function fetchRecipePage(
  url: string,
  overrides: Partial<RecipePageDependencies> = {},
): Promise<RecipePageResult> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const userAgent = dependencies.readUserAgent();
  const abortController = new AbortController();
  const timeUp = new Promise<never>((_resolve, reject) => {
    abortController.signal.addEventListener("abort", () => reject(abortController.signal.reason), {
      once: true,
    });
  });
  // Nothing may be left waiting on this when the time is up, or the runtime reports it as unhandled.
  timeUp.catch(() => {});
  const budget: Budget = { signal: abortController.signal, timeUp };
  const timer = setTimeout(
    () => abortController.abort(new DOMException("The recipe page took too long.", "TimeoutError")),
    dependencies.timeoutMilliseconds,
  );
  try {
    let current = parseFetchableUrl(url);
    for (let redirectsFollowed = 0; ; redirectsFollowed += 1) {
      if (current === null) {
        return failure("blocked_address");
      }
      const check = await checkHost(current, budget, dependencies.resolveDns);
      if (check !== "public") {
        return failure(check === "blocked" ? "blocked_address" : "http_error");
      }

      const response = await withinBudget(
        dependencies.fetchPage(current.href, {
          method: "GET",
          redirect: "manual",
          signal: abortController.signal,
          headers: { "User-Agent": userAgent, Accept: "text/html" },
        }),
        timeUp,
      );

      if (redirectStatuses.has(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (location === null || redirectsFollowed >= maximumRedirects) {
          return failure("http_error");
        }
        current = parseFetchableUrl(new URL(location, current).href);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        return failure("http_error");
      }
      if (!isHtml(response)) {
        await response.body?.cancel();
        return failure("not_html");
      }
      const html = await readCappedBody(response);
      return html === null ? failure("too_large") : { ok: true, html, finalUrl: current.href };
    }
  } catch {
    // The caught value can quote the address, so it is not kept or logged.
    return failure(abortController.signal.aborted ? "timeout" : "http_error");
  } finally {
    clearTimeout(timer);
  }
}
