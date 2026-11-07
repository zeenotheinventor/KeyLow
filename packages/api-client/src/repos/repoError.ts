const KONG_BAD_GATEWAY_MESSAGE = "An invalid response was received from the upstream server";
const FAILED_FETCH_MESSAGE = /^(TypeError|AbortError|FetchError): [^\r\n]{1,80}$/;

/**
 * The message of an answer with no code, when it is one of the two known kinds: Kong's own sentence, or
 * a failed fetch such as `TypeError: fetch failed`. Any other text is upstream text that could echo a
 * path or a query, so it is not named.
 */
const knownMessage = (message: string | undefined) => {
  if (message === KONG_BAD_GATEWAY_MESSAGE) {
    return message;
  }
  return message !== undefined && FAILED_FETCH_MESSAGE.test(message) && !message.includes("://")
    ? message
    : "no code";
};

/**
 * The one error a repo throws for a failed database request: the action and the code, and the code
 * alone as the cause. The database's message, details and hint are never kept, because they can
 * quote the failing row, and a row can hold health data. A caller that needs to tell failures apart
 * reads `cause.code`.
 *
 * The one exception is an answer with no code. Postgres and PostgREST always send one, so an answer
 * without it did not come from the database. It names Kong's sentence (a 502 when PostgREST drops the
 * connection) or a failed fetch, in place of the code, so the error does not read `(undefined)`. Any
 * other text is not named, and the error reads `(no code)`.
 */
export const repoError = (
  action: string,
  cause: { code: string | undefined; message?: string | undefined },
) =>
  new Error(`Could not ${action} (${cause.code || knownMessage(cause.message)})`, {
    cause: { code: cause.code },
  });
