import { EntryNotFoundError } from "@keylow/api-client";
import { buildLogEntry } from "@keylow/core/diary";
import { buildFood } from "@keylow/core/testing";

import { logAgain, logNextSet, undoLast } from "./actions";
import { createInMemoryWidgetBridge } from "./inMemoryWidgetBridge";
import { WidgetActionError } from "./widgetActionError";
import { onWidgetActionDone } from "./widgetActionEvents";
import {
  ENTRY_ID,
  EXERCISE_ID,
  NEW_ROW_ID,
  NOW,
  SESSION_ID,
} from "../../test/support/widgetFixtures";

import type { WidgetActionDependencies, WidgetRepositories } from "./actions";
import type { FoodLogEntry } from "@keylow/api-client";

const food = buildFood();
const entry: FoodLogEntry = {
  ...buildLogEntry({
    food,
    quantity: 150,
    unit: "g",
    loggedAt: "2026-11-02T08:00:00.000Z",
    localDate: "2026-11-02",
  }),
  id: ENTRY_ID,
  created_at: "2026-11-02T08:00:00.000Z",
  kcal: 150,
};

const DAY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ROUTINE_ID = "rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr";

const sessionSet = (position: number) => ({
  id: `${position}0000000-0000-4000-8000-000000000000`,
  exercise_id: EXERCISE_ID,
  position,
  set_type: "working" as const,
  reps: 8,
  load_kg: 70,
  rir: null,
  rpe: null,
  performed_at: `2026-11-03T11:0${position}:00.000Z`,
  deleted_at: null,
});

const routineDetail = {
  id: ROUTINE_ID,
  days: [
    {
      id: DAY_ID,
      exercises: [
        {
          position: 0,
          exercise_id: EXERCISE_ID,
          target_sets: 3,
          rep_min: 6,
          rep_max: 10,
          target_rir: null,
        },
      ],
    },
  ],
};

// A mock typed as the repository function it stands in for, so a fake with fewer parameters still fits.
function mocked<Repository extends (...args: never[]) => unknown>(
  implementation: (...args: Parameters<Repository>) => ReturnType<Repository>,
): jest.Mock<ReturnType<Repository>, Parameters<Repository>> {
  return jest.fn<ReturnType<Repository>, Parameters<Repository>>(implementation);
}

type Repository<Name extends keyof WidgetRepositories> = WidgetRepositories[Name];

function createRepositories() {
  return {
    getLogEntry: mocked<Repository<"getLogEntry">>(() => Promise.resolve(entry)),
    getFood: mocked<Repository<"getFood">>(() => Promise.resolve(food)),
    listFoodPortions: mocked<Repository<"listFoodPortions">>(() => Promise.resolve([])),
    getMyTimeZone: mocked<Repository<"getMyTimeZone">>(() => Promise.resolve("Europe/London")),
    logFood: mocked<Repository<"logFood">>(() => Promise.resolve({ id: NEW_ROW_ID })),
    softDeleteLogEntry: mocked<Repository<"softDeleteLogEntry">>(() => Promise.resolve()),
    getActiveSession: mocked<Repository<"getActiveSession">>(() =>
      Promise.resolve({
        id: SESSION_ID,
        routine_day_id: DAY_ID,
        sets: [sessionSet(0), sessionSet(1)],
      }),
    ),
    getActiveRoutine: mocked<Repository<"getActiveRoutine">>(() =>
      Promise.resolve({ id: ROUTINE_ID }),
    ),
    getRoutine: mocked<Repository<"getRoutine">>(() => Promise.resolve(routineDetail)),
    getLastPerformance: mocked<Repository<"getLastPerformance">>(() => Promise.resolve([])),
    addSet: mocked<Repository<"addSet">>(() => Promise.resolve({ id: NEW_ROW_ID })),
    removeSet: mocked<Repository<"removeSet">>(() => Promise.resolve(undefined)),
  } satisfies WidgetRepositories;
}

function setUp(overrides: Partial<WidgetActionDependencies> = {}) {
  const repositories = createRepositories();
  const bridge = createInMemoryWidgetBridge();
  const dependencies: WidgetActionDependencies = {
    repositories,
    bridge,
    isOnline: () => Promise.resolve(true),
    now: () => NOW,
    ...overrides,
  };
  return { repositories, bridge, dependencies };
}

describe("the action events", () => {
  it("should tell the running app when an action wrote", async () => {
    const listener = jest.fn();
    const stop = onWidgetActionDone(listener);
    const { dependencies } = setUp();

    await logAgain({ entryId: ENTRY_ID }, dependencies);
    stop();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should not tell it when an action wrote nothing", async () => {
    const listener = jest.fn();
    const stop = onWidgetActionDone(listener);
    const { dependencies } = setUp({ isOnline: () => Promise.resolve(false) });

    await logAgain({ entryId: ENTRY_ID }, dependencies);
    stop();

    expect(listener).not.toHaveBeenCalled();
  });
});

const logAgainInput = { entryId: ENTRY_ID };
const logSetInput = { sessionId: SESSION_ID, exerciseId: EXERCISE_ID, setNumber: 3 };

describe("logAgain", () => {
  it("should log the entry's last amount now and record the row for Undo", async () => {
    const { repositories, bridge, dependencies } = setUp();

    const result = await logAgain(logAgainInput, dependencies);

    expect(result).toEqual({ status: "done" });
    expect(repositories.logFood).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 150,
        unit: "g",
        loggedAt: NOW.toISOString(),
        localDate: "2026-11-03",
      }),
    );
    expect(await bridge.readPendingUndo()).toEqual({
      action: "log_again",
      rowId: NEW_ROW_ID,
      sourceEntryId: ENTRY_ID,
      at: NOW.toISOString(),
    });
  });

  it("should ask for a redraw after a write", async () => {
    const { bridge, dependencies } = setUp();

    await logAgain(logAgainInput, dependencies);

    expect(bridge.redrawCount()).toBe(1);
  });

  it("should write nothing offline and say it could not log", async () => {
    const { repositories, bridge, dependencies } = setUp({
      isOnline: () => Promise.resolve(false),
    });

    const result = await logAgain(logAgainInput, dependencies);

    expect(result).toMatchObject({ status: "failed", failure: "couldnt_log" });
    expect(result.status === "failed" && result.error).toMatchObject({
      action: "log_again",
      code: "offline",
    });
    expect(repositories.logFood).not.toHaveBeenCalled();
    expect(await bridge.readPendingUndo()).toBeNull();
  });

  it("should write once for a double tap", async () => {
    const { repositories, dependencies } = setUp();

    const results = await Promise.all([
      logAgain(logAgainInput, dependencies),
      logAgain(logAgainInput, dependencies),
    ]);

    expect(repositories.logFood).toHaveBeenCalledTimes(1);
    expect(results.map(({ status }) => status).sort()).toEqual(["done", "ignored"]);
  });

  it("should accept a tap again once the first has settled", async () => {
    const { repositories, dependencies } = setUp();

    await logAgain(logAgainInput, dependencies);
    await logAgain(logAgainInput, dependencies);

    expect(repositories.logFood).toHaveBeenCalledTimes(2);
  });

  it("should fail with a code when the entry is gone", async () => {
    const { repositories, dependencies } = setUp();
    repositories.getLogEntry.mockResolvedValue(null);

    const result = await logAgain(logAgainInput, dependencies);

    expect(result.status === "failed" && result.error.code).toBe("entry_gone");
    expect(repositories.logFood).not.toHaveBeenCalled();
  });

  it("should fail when the food of the entry was deleted", async () => {
    const { repositories, dependencies } = setUp();
    repositories.getFood.mockResolvedValue({ ...food, deleted_at: "2026-11-01T00:00:00Z" });

    const result = await logAgain(logAgainInput, dependencies);

    expect(result.status === "failed" && result.error.code).toBe("entry_gone");
  });

  it("should carry the action and a code and no data when the write fails", async () => {
    const { repositories, bridge, dependencies } = setUp();
    repositories.logFood.mockRejectedValue(new Error("Could not log 150 g of Test food"));

    const result = await logAgain(logAgainInput, dependencies);

    expect(result).toMatchObject({ status: "failed", failure: "couldnt_log" });
    const error = result.status === "failed" ? result.error : null;
    expect(error).toBeInstanceOf(WidgetActionError);
    expect(error?.message).toBe("Widget action log_again failed: request_failed");
    expect(error?.cause).toBeUndefined();
    expect(await bridge.readPendingUndo()).toBeNull();
  });
});

describe("logNextSet", () => {
  it("should log the prefilled set and record the row for Undo", async () => {
    const { repositories, bridge, dependencies } = setUp();

    const result = await logNextSet(logSetInput, dependencies);

    expect(result).toEqual({ status: "done" });
    expect(repositories.addSet.mock.calls[0]?.[0]).toMatchObject({
      sessionId: SESSION_ID,
      exerciseId: EXERCISE_ID,
      unit: "kg",
      now: NOW,
      draft: { load: "70", reps: "8" },
    });
    expect(await bridge.readPendingUndo()).toEqual({
      action: "log_set",
      rowId: NEW_ROW_ID,
      at: NOW.toISOString(),
    });
    expect(bridge.redrawCount()).toBe(1);
  });

  it("should refuse a stale set when the session is another one", async () => {
    const { repositories, dependencies } = setUp();

    const result = await logNextSet({ ...logSetInput, sessionId: NEW_ROW_ID }, dependencies);

    expect(result).toMatchObject({ status: "failed", failure: "session_moved_on" });
    expect(repositories.addSet).not.toHaveBeenCalled();
  });

  it("should refuse a stale set when no session is open", async () => {
    const { repositories, dependencies } = setUp();
    repositories.getActiveSession.mockResolvedValue(null);

    const result = await logNextSet(logSetInput, dependencies);

    expect(result).toMatchObject({ failure: "session_moved_on" });
    expect(repositories.addSet).not.toHaveBeenCalled();
  });

  it("should refuse a stale set when the set position moved on", async () => {
    const { repositories, dependencies } = setUp();

    const result = await logNextSet({ ...logSetInput, setNumber: 2 }, dependencies);

    expect(result).toMatchObject({ failure: "session_moved_on" });
    expect(repositories.addSet).not.toHaveBeenCalled();
  });

  it("should refuse a stale set when another exercise is next", async () => {
    const { repositories, dependencies } = setUp();

    const result = await logNextSet({ ...logSetInput, exerciseId: NEW_ROW_ID }, dependencies);

    expect(result).toMatchObject({ failure: "session_moved_on" });
    expect(repositories.addSet).not.toHaveBeenCalled();
  });

  it("should write nothing offline", async () => {
    const { repositories, dependencies } = setUp({ isOnline: () => Promise.resolve(false) });

    const result = await logNextSet(logSetInput, dependencies);

    expect(result).toMatchObject({ status: "failed", failure: "couldnt_log" });
    expect(repositories.getActiveSession).not.toHaveBeenCalled();
    expect(repositories.addSet).not.toHaveBeenCalled();
  });

  it("should write once for a double tap", async () => {
    const { repositories, dependencies } = setUp();

    await Promise.all([
      logNextSet(logSetInput, dependencies),
      logNextSet(logSetInput, dependencies),
    ]);

    expect(repositories.addSet).toHaveBeenCalledTimes(1);
  });

  it("should not log a set it has nothing to fill from", async () => {
    const { repositories, dependencies } = setUp();
    repositories.getActiveSession.mockResolvedValue({
      id: SESSION_ID,
      routine_day_id: DAY_ID,
      sets: [],
    });

    const result = await logNextSet({ ...logSetInput, setNumber: 1 }, dependencies);

    expect(result.status === "failed" && result.error.code).toBe("nothing_to_log");
    expect(repositories.addSet).not.toHaveBeenCalled();
  });
});

describe("undoLast", () => {
  const record = (action: "log_again" | "log_set", at = NOW.toISOString()) => ({
    action,
    rowId: NEW_ROW_ID,
    at,
  });

  it("should remove exactly the entry Log again wrote and clear the record", async () => {
    const { repositories, bridge, dependencies } = setUp();
    await bridge.writePendingUndo(record("log_again"));

    const result = await undoLast(dependencies);

    expect(result).toEqual({ status: "done" });
    expect(repositories.softDeleteLogEntry).toHaveBeenCalledWith(NEW_ROW_ID);
    expect(repositories.removeSet).not.toHaveBeenCalled();
    expect(await bridge.readPendingUndo()).toBeNull();
    expect(bridge.redrawCount()).toBe(1);
  });

  it("should remove exactly the set Log set wrote", async () => {
    const { repositories, bridge, dependencies } = setUp();
    await bridge.writePendingUndo(record("log_set"));

    await undoLast(dependencies);

    expect(repositories.removeSet).toHaveBeenCalledWith(NEW_ROW_ID);
    expect(repositories.softDeleteLogEntry).not.toHaveBeenCalled();
  });

  it("should do nothing when the record is gone", async () => {
    const { repositories, dependencies } = setUp();

    expect(await undoLast(dependencies)).toEqual({ status: "ignored" });
    expect(repositories.softDeleteLogEntry).not.toHaveBeenCalled();
    expect(repositories.removeSet).not.toHaveBeenCalled();
  });

  it("should do nothing once the record has expired, and drop it", async () => {
    const { repositories, bridge, dependencies } = setUp();
    await bridge.writePendingUndo(record("log_again", "2026-11-03T11:49:00.000Z"));

    expect(await undoLast(dependencies)).toEqual({ status: "ignored" });
    expect(repositories.softDeleteLogEntry).not.toHaveBeenCalled();
    expect(await bridge.readPendingUndo()).toBeNull();
  });

  it("should write nothing offline and keep the record", async () => {
    const { repositories, bridge, dependencies } = setUp({
      isOnline: () => Promise.resolve(false),
    });
    await bridge.writePendingUndo(record("log_again"));

    const result = await undoLast(dependencies);

    expect(result).toMatchObject({ status: "failed", failure: "couldnt_undo" });
    expect(repositories.softDeleteLogEntry).not.toHaveBeenCalled();
    expect(await bridge.readPendingUndo()).not.toBeNull();
  });

  it("should keep the record when the removal fails", async () => {
    const { repositories, bridge, dependencies } = setUp();
    repositories.softDeleteLogEntry.mockRejectedValue(new Error("boom"));
    await bridge.writePendingUndo(record("log_again"));

    const result = await undoLast(dependencies);

    expect(result).toMatchObject({ status: "failed", failure: "couldnt_undo" });
    expect(result.status === "failed" && result.error.action).toBe("undo");
    expect(await bridge.readPendingUndo()).not.toBeNull();
  });

  it("should count an entry that is already gone as undone, and clear the record", async () => {
    const { repositories, bridge, dependencies } = setUp();
    repositories.softDeleteLogEntry.mockRejectedValue(new EntryNotFoundError());
    await bridge.writePendingUndo(record("log_again"));

    expect(await undoLast(dependencies)).toEqual({ status: "ignored" });
    expect(await bridge.readPendingUndo()).toBeNull();
    expect(bridge.redrawCount()).toBe(1);
  });

  it("should count a set that is already gone as undone, and clear the record", async () => {
    const { repositories, bridge, dependencies } = setUp();
    repositories.removeSet.mockRejectedValue(
      new Error("Could not remove the set (PGRST116)", { cause: { code: "PGRST116" } }),
    );
    await bridge.writePendingUndo(record("log_set"));

    expect(await undoLast(dependencies)).toEqual({ status: "ignored" });
    expect(await bridge.readPendingUndo()).toBeNull();
  });

  it("should not clear the record for a failure that is not a missing row", async () => {
    const { repositories, bridge, dependencies } = setUp();
    repositories.removeSet.mockRejectedValue(
      new Error("Could not remove the set (57014)", { cause: { code: "57014" } }),
    );
    await bridge.writePendingUndo(record("log_set"));

    expect(await undoLast(dependencies)).toMatchObject({ status: "failed" });
    expect(await bridge.readPendingUndo()).not.toBeNull();
  });

  it("should remove once for a double tap", async () => {
    const { repositories, bridge, dependencies } = setUp();
    await bridge.writePendingUndo(record("log_again"));

    await Promise.all([undoLast(dependencies), undoLast(dependencies)]);

    expect(repositories.softDeleteLogEntry).toHaveBeenCalledTimes(1);
  });
});
