import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { setDayComplete } from "../../src/repos/dayLogs";
import { repoError } from "../../src/repos/repoError";
import { createTestClient } from "../createTestClient";
import { REST_URL, postgrestRows } from "../support/postgrest";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

// Kong answers 502 with this JSON when PostgREST drops the connection, and PostgREST's client keeps the
// body as `{ message }` with no code. It is a gateway sentence, never a database answer, so it names no row.
const GATEWAY_MESSAGE = "An invalid response was received from the upstream server";

describe("repoError", () => {
  it("should name the action and the code, and keep the code alone as the cause", () => {
    const error = repoError("mark the day", {
      code: "23514",
      message: "Failing row contains (380)",
    });

    expect(error.message).toBe("Could not mark the day (23514)");
    expect(error.cause).toStrictEqual({ code: "23514" });
  });

  it("should name the gateway's own message when an answer has no code, not undefined", () => {
    const error = repoError("mark the day", { code: undefined, message: GATEWAY_MESSAGE });

    expect(error.message).toBe(`Could not mark the day (${GATEWAY_MESSAGE})`);
    expect(error.cause).toStrictEqual({ code: undefined });
  });

  it("should name the message when the code is empty, as a failed fetch leaves it", () => {
    const error = repoError("log the entries", { code: "", message: "TypeError: fetch failed" });

    expect(error.message).toBe("Could not log the entries (TypeError: fetch failed)");
  });

  it("should say there was no code when there is no message either", () => {
    expect(repoError("mark the day", { code: undefined }).message).toBe(
      "Could not mark the day (no code)",
    );
  });

  it("should keep a long message to one short line", () => {
    const error = repoError("mark the day", { code: "", message: `<html>\n${"x".repeat(500)}` });

    expect(error.message).not.toContain("\n");
    expect(error.message.length).toBeLessThan(250);
  });
});

describe("a write that Kong answers with a 502", () => {
  it("should name the gateway's sentence, not undefined, when the day cannot be marked", async () => {
    server.use(
      http.patch(`${REST_URL}/day_logs`, ({ request }) => postgrestRows(request, [])),
      http.post(`${REST_URL}/day_logs`, () =>
        HttpResponse.json({ message: GATEWAY_MESSAGE }, { status: 502 }),
      ),
    );

    await expect(setDayComplete(createTestClient(), "2026-11-07", true)).rejects.toThrow(
      new Error(`Could not mark the day (${GATEWAY_MESSAGE})`),
    );
  });
});
