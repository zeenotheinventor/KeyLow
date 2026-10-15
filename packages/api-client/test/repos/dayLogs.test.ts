import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { setDayComplete } from "../../src/repos/dayLogs";
import { createTestClient } from "../createTestClient";
import { answerDayLogs } from "../support/dayLogsServer";

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

const DAY = "2026-10-14";
const completedBody = z.strictObject({
  is_complete: z.literal(true),
  completed_at: z.iso.datetime(),
});
const newDayLogBody = completedBody.extend({ local_date: z.literal(DAY) });

describe("setDayComplete", () => {
  it("should mark a day that has a day log complete, with the time it was completed", async () => {
    const { handlers, writes } = answerDayLogs({ existingDays: [DAY] });
    server.use(...handlers);

    await setDayComplete(createTestClient(), DAY, true);

    expect(writes).toHaveLength(1);
    expect(writes[0]?.method).toBe("PATCH");
    expect(writes[0]?.url.searchParams.get("local_date")).toBe(`eq.${DAY}`);
    expect(completedBody.safeParse(writes[0]?.body).success).toBe(true);
  });

  it("should add the day log when the day has none", async () => {
    const { handlers, writes } = answerDayLogs({ existingDays: [] });
    server.use(...handlers);

    await setDayComplete(createTestClient(), DAY, true);

    expect(writes.map((write) => write.method)).toEqual(["PATCH", "POST"]);
    expect(newDayLogBody.safeParse(writes[1]?.body).success).toBe(true);
  });

  it("should clear the completion and its time when the day is marked incomplete", async () => {
    const { handlers, writes } = answerDayLogs({ existingDays: [DAY] });
    server.use(...handlers);

    await setDayComplete(createTestClient(), DAY, false);

    expect(writes).toHaveLength(1);
    expect(writes[0]?.body).toEqual({ is_complete: false, completed_at: null });
  });

  it("should write no day log for an incomplete day that has none", async () => {
    const { handlers, writes } = answerDayLogs({ existingDays: [] });
    server.use(...handlers);

    await setDayComplete(createTestClient(), DAY, false);

    expect(writes.map((write) => write.method)).toEqual(["PATCH"]);
  });

  it("should update the day log another call added a moment earlier", async () => {
    const { handlers, writes } = answerDayLogs({ existingDays: [], insertConflicts: true });
    server.use(...handlers);

    await setDayComplete(createTestClient(), DAY, true);

    expect(writes.map((write) => write.method)).toEqual(["PATCH", "POST", "PATCH"]);
  });

  it("should refuse a day that is not a calendar date, before any request", async () => {
    const { handlers, writes } = answerDayLogs({ existingDays: [] });
    server.use(...handlers);

    await expect(setDayComplete(createTestClient(), "yesterday", true)).rejects.toThrow(RangeError);
    expect(writes).toEqual([]);
  });
});
