import { HttpResponse } from "msw";
import { expect } from "vitest";

/** Invented values, not a real person's. A database error quotes the failing row the way these sit in it. */
export const QUOTED_FOOD = "Porridge oats";
export const QUOTED_NUMBER = "380";
const QUOTED_ROW = `Failing row contains (${QUOTED_FOOD}, ${QUOTED_NUMBER})`;

/** What PostgREST answers when a constraint fails: the message, the details and the hint all quote the row. */
export const databaseErrorQuotingTheRow = (code = "23514") =>
  HttpResponse.json(
    {
      code,
      message: `new row violates check constraint: ${QUOTED_ROW}`,
      details: QUOTED_ROW,
      hint: `Check ${QUOTED_FOOD}`,
    },
    { status: 400 },
  );

/** Runs `run` and gives back what it threw, so a test can look at the error itself. */
export async function errorThrownBy(run: () => Promise<unknown>): Promise<Error> {
  const thrown: unknown = await run().then(
    () => new Error("Nothing was thrown"),
    (error: unknown) => error,
  );
  if (!(thrown instanceof Error)) {
    throw new Error("Something that is not an Error was thrown");
  }
  return thrown;
}

/**
 * The message, the serialised error and the cause are each checked on their own, because
 * `JSON.stringify` of an Error leaves out both its message and its cause.
 */
export function expectNoQuotedText(error: Error) {
  const holders = {
    message: error.message,
    stack: error.stack ?? "",
    serialised: JSON.stringify(error),
    cause: JSON.stringify({ cause: error.cause }),
  };
  for (const [holder, text] of Object.entries(holders)) {
    expect(text, holder).not.toContain(QUOTED_FOOD);
    expect(text, holder).not.toContain(QUOTED_NUMBER);
  }
}

/** The one shape every repo error built from a database error has: the action and the code, and the code alone as the cause. */
export function expectOnlyTheCode(error: Error, action: string, code: string) {
  expectNoQuotedText(error);
  expect(error.message).toBe(`Could not ${action} (${code})`);
  expect(error.cause).toStrictEqual({ code });
}
