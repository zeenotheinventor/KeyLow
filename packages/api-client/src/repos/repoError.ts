const MAX_UNCODED_MESSAGE_LENGTH = 120;

const uncodedMessage = (message: string | undefined) =>
  message === undefined || message === ""
    ? "no code"
    : message.replace(/\s+/g, " ").trim().slice(0, MAX_UNCODED_MESSAGE_LENGTH);

/**
 * The one error a repo throws for a failed database request: the action and the code, and the code
 * alone as the cause. The database's message, details and hint are never kept, because they can
 * quote the failing row, and a row can hold health data. A caller that needs to tell failures apart
 * reads `cause.code`.
 *
 * The one exception is an answer with no code. Postgres and PostgREST always send one, so an answer
 * without it did not come from the database: it is the gateway's own sentence (Kong's 502 when
 * PostgREST drops the connection) or a failed fetch, and it names no row. It is named in place of the
 * code, cut to one short line, so the error does not read `(undefined)`.
 */
export const repoError = (
  action: string,
  cause: { code: string | undefined; message?: string | undefined },
) =>
  new Error(`Could not ${action} (${cause.code || uncodedMessage(cause.message)})`, {
    cause: { code: cause.code },
  });
