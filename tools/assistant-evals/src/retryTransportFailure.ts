const MAX_TRIES = 3;
const PAUSE_BETWEEN_TRIES_MS = 100;

/**
 * True for a repo error whose cause has no database code. Postgres and PostgREST always answer with
 * one, so a missing code means the request never got a database answer: Kong's 502 when PostgREST
 * drops the connection it reuses (the log reads `recv() failed (104: Connection reset by peer)`), or
 * a fetch that failed. A refusal from the database has a code and is never retried.
 */
const isTransportFailure = (error: unknown): boolean =>
  error instanceof Error &&
  typeof error.cause === "object" &&
  error.cause !== null &&
  "code" in error.cause &&
  !error.cause.code;

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/**
 * Runs a fixture write, and runs it again, up to three tries in all, when it failed on a dropped
 * connection to the local stack. The last error is thrown as it came, with its real message.
 */
export async function retryTransportFailure<Result>(write: () => Promise<Result>): Promise<Result> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await write();
    } catch (error) {
      if (attempt >= MAX_TRIES || !isTransportFailure(error)) {
        throw error;
      }
      await pause(PAUSE_BETWEEN_TRIES_MS);
    }
  }
}
