const KONG_BAD_GATEWAY_MESSAGE = "An invalid response was received from the upstream server";
const RETRY_DELAY_MILLISECONDS = 200;
// The race is between the gateway and PostgREST, so only calls to PostgREST are retried.
const POSTGREST_PATH_PREFIX = "/rest/v1/";
// A real cause chain is two or three deep. The cap stops a circular one.
const MAXIMUM_CAUSE_DEPTH = 10;
// Node's fetch reports a dead socket with one of these codes, or with the message on a bare error.
const CONNECTION_RESET_CODES = new Set(["ECONNRESET", "UND_ERR_SOCKET"]);
const CONNECTION_RESET_MESSAGE = /ECONNRESET|socket hang up|other side closed/i;

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

/** True for a connection reset at any depth of the error's `cause` chain, where undici puts it. */
function isConnectionReset(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < MAXIMUM_CAUSE_DEPTH && current instanceof Error; depth += 1) {
    const code = "code" in current ? current.code : undefined;
    if (
      (typeof code === "string" && CONNECTION_RESET_CODES.has(code)) ||
      CONNECTION_RESET_MESSAGE.test(current.message)
    ) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

/**
 * True when the gateway answered 502 with its own message, either as plain text or as a JSON
 * `message`. A PostgREST error also carries a `code`, so it is never mistaken for the gateway.
 * Reads a clone, so the response the caller gets keeps an unread body.
 */
async function isGatewayBadGateway(response: Response): Promise<boolean> {
  if (response.status !== 502) {
    return false;
  }
  const text = (await response.clone().text()).trim();
  if (text === KONG_BAD_GATEWAY_MESSAGE) {
    return true;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      !("code" in parsed) &&
      "message" in parsed &&
      parsed.message === KONG_BAD_GATEWAY_MESSAGE
    );
  } catch {
    return false;
  }
}

/** True when the request goes to PostgREST, whether `input` is a string, a `URL` or a `Request`. */
function isPostgrestRequest(input: Parameters<typeof fetch>[0]): boolean {
  const address = input instanceof Request ? input.url : input;
  try {
    return new URL(address, "http://localhost").pathname.startsWith(POSTGREST_PATH_PREFIX);
  } catch {
    return false;
  }
}

/** A string body can be sent again. A stream, or a request object that carries one, cannot. */
function canBeSentAgain(input: Parameters<typeof fetch>[0], init: RequestInit | undefined) {
  if (init?.body instanceof ReadableStream) {
    return false;
  }
  return !(input instanceof Request && input.body !== null);
}

/**
 * Wraps `fetch` for the integration test clients. The local gateway sometimes reuses a keepalive
 * connection that PostgREST has just closed, and the request on that dead socket fails before
 * PostgREST reads it. Calls to functions and auth go straight through. This sends the request once more, after about 200 milliseconds, only when
 * that is what happened: a 502 with the gateway's own message, or a connection reset. Anything
 * else is returned or thrown at once, and a second failure is returned or thrown as it is.
 */
export function retryOnStaleConnection(
  baseFetch: typeof fetch = fetch,
  retryDelayMilliseconds: number = RETRY_DELAY_MILLISECONDS,
): typeof fetch {
  return async (input, init) => {
    if (!isPostgrestRequest(input)) {
      return baseFetch(input, init);
    }
    const retryable = canBeSentAgain(input, init);
    let firstResponse: Response;
    try {
      firstResponse = await baseFetch(input, init);
    } catch (error) {
      if (!retryable || !isConnectionReset(error)) {
        throw error;
      }
      await wait(retryDelayMilliseconds);
      return baseFetch(input, init);
    }
    if (!retryable || !(await isGatewayBadGateway(firstResponse))) {
      return firstResponse;
    }
    await firstResponse.body?.cancel();
    await wait(retryDelayMilliseconds);
    return baseFetch(input, init);
  };
}
