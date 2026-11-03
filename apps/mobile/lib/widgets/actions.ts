import { EntryNotFoundError } from "@keylow/api-client";
import { toLocalDate } from "@keylow/core/dates";
import {
  planProgress,
  prefillNextSet,
  scaffoldSession,
  setDraftOfValues,
  setValuesOfPrefill,
} from "@keylow/core/training";
import { isUndoWindowOpen } from "@keylow/core/widgets";

import { amountLastLogged } from "../amountLastLogged";
import { runOnce } from "./inFlight";
import { WidgetActionError } from "./widgetActionError";
import { emitWidgetActionDone } from "./widgetActionEvents";

import type { WidgetActionCode, WidgetActionName, WidgetActionResult, WidgetBridge } from "./types";
import type { LogEntry, LogFoodInput, SetAdd } from "@keylow/api-client";
import type { Food, FoodPortion } from "@keylow/core/schemas";
import type {
  LastPerformanceSet,
  PrefillSessionSet,
  ProgressSet,
  ScaffoldRoutineExercise,
} from "@keylow/core/training";
import type { WidgetFailure } from "@keylow/core/widgets";

// The one-tap actions of the widgets (ADR 0007, "One-tap actions"). They run in the app's JS with no React,
// from a task handler that may start with the app closed, so everything they use is passed in.

type SessionSetRow = ProgressSet & PrefillSessionSet;

/**
 * The reads and writes the actions make, with the stored session's Supabase client already bound in. A
 * structural subset of the repositories, so a test gives the few fields an action reads.
 */
export type WidgetRepositories = Readonly<{
  getLogEntry: (id: string) => Promise<LogEntry | null>;
  getFood: (id: string) => Promise<Food | null>;
  listFoodPortions: (foodId: string) => Promise<FoodPortion[]>;
  getMyTimeZone: () => Promise<string | null>;
  logFood: (input: LogFoodInput) => Promise<{ id: string }>;
  softDeleteLogEntry: (id: string) => Promise<void>;
  getActiveSession: () => Promise<{
    id: string;
    routine_day_id: string | null;
    sets: readonly SessionSetRow[];
  } | null>;
  getActiveRoutine: () => Promise<{ id: string } | null>;
  getRoutine: (id: string) => Promise<{
    days: readonly { id: string; exercises: readonly ScaffoldRoutineExercise[] }[];
  } | null>;
  getLastPerformance: (
    exerciseId: string,
    options: { excludeSessionId: string },
  ) => Promise<readonly { sets: readonly LastPerformanceSet[] }[]>;
  addSet: (input: SetAdd) => Promise<{ id: string }>;
  removeSet: (id: string) => Promise<unknown>;
}>;

export type WidgetActionDependencies = Readonly<{
  repositories: WidgetRepositories;
  bridge: WidgetBridge;
  /** Whether the server can be reached. There is no offline queue, so an action offline writes nothing. */
  isOnline: () => Promise<boolean>;
  now: () => Date;
}>;

type Outcome = "done" | "ignored";

const failureOf = (error: WidgetActionError): WidgetFailure => {
  if (error.code === "session_moved_on") {
    return "session_moved_on";
  }
  return error.action === "undo" ? "couldnt_undo" : "couldnt_log";
};

const failed = (error: WidgetActionError): WidgetActionResult => ({
  status: "failed",
  failure: failureOf(error),
  error,
});

/** Whether a write failed because its row is not there any more: the repositories' not-found, or PostgREST's PGRST116. */
const isRowGone = (error: unknown): boolean => {
  if (error instanceof EntryNotFoundError) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  const { cause } = error;

  return (
    typeof cause === "object" && cause !== null && "code" in cause && cause.code === "PGRST116"
  );
};

/**
 * Runs an action once at a time (a second tap while one is under way is ignored), online only. Whatever
 * fails is reduced to the action and a code: the cause can quote an amount or a set, which is health data,
 * so it is not kept.
 */
async function run(
  action: WidgetActionName,
  { isOnline }: WidgetActionDependencies,
  work: () => Promise<Outcome>,
): Promise<WidgetActionResult> {
  const result = await runOnce(action, async (): Promise<WidgetActionResult> => {
    try {
      if (!(await isOnline())) {
        return failed(new WidgetActionError(action, "offline"));
      }
      const status = await work();
      if (status === "done") {
        emitWidgetActionDone();
      }
      return { status };
    } catch (error) {
      const code: WidgetActionCode =
        error instanceof WidgetActionError ? error.code : "request_failed";
      return failed(new WidgetActionError(action, code));
    }
  });

  return result ?? { status: "ignored" };
}

export type LogAgainInput = Readonly<{ entryId: string }>;

/**
 * Logs the food of a recent entry again: the entry is read by id, and `logFood` builds the new one in core
 * at write time from the food as it is now, with the last amount and the time of the tap.
 */
export function logAgain(
  { entryId }: LogAgainInput,
  dependencies: WidgetActionDependencies,
): Promise<WidgetActionResult> {
  const { repositories, bridge, now } = dependencies;

  return run("log_again", dependencies, async () => {
    const entry = await repositories.getLogEntry(entryId);
    if (entry?.item_type !== "food") {
      throw new WidgetActionError("log_again", "entry_gone");
    }
    const food = await repositories.getFood(entry.food_id);
    if (food === null || food.deleted_at !== null) {
      throw new WidgetActionError("log_again", "entry_gone");
    }
    const [portions, timeZone] = await Promise.all([
      repositories.listFoodPortions(food.id),
      repositories.getMyTimeZone(),
    ]);
    const amount = amountLastLogged(
      {
        foodId: food.id,
        entryId: entry.id,
        loggedAt: entry.logged_at,
        portionId: entry.portion_id,
        snapshot: entry.snapshot,
      },
      portions,
    );
    const tapped = now();
    const written = await repositories.logFood({
      food,
      quantity: amount.quantity,
      unit: amount.unit,
      ...(amount.unit === "portion" ? { portion: amount.portion } : {}),
      foodPortions: portions,
      loggedAt: tapped.toISOString(),
      // The diary reads its days in the profile's zone. A profile row always exists, and UTC stands in if not.
      localDate: toLocalDate(tapped, timeZone ?? "UTC"),
    });
    await bridge.writePendingUndo({
      action: "log_again",
      rowId: written.id,
      sourceEntryId: entry.id,
      at: tapped.toISOString(),
    });
    await bridge.requestRedraw();
    return "done";
  });
}

export type LogNextSetInput = Readonly<{
  sessionId: string;
  exerciseId: string;
  setNumber: number;
}>;

/**
 * Logs the next set of the open session, as the snapshot showed it. The session id, the exercise and the
 * set position are checked against the open session first, and a mismatch logs nothing ("Your session moved
 * on"). The set is filled the way the session screen fills it (the last set of the session, else last time).
 */
export function logNextSet(
  { sessionId, exerciseId, setNumber }: LogNextSetInput,
  dependencies: WidgetActionDependencies,
): Promise<WidgetActionResult> {
  const { repositories, bridge, now } = dependencies;

  return run("log_set", dependencies, async () => {
    const movedOn = new WidgetActionError("log_set", "session_moved_on");
    const session = await repositories.getActiveSession();
    if (session?.id !== sessionId || session.routine_day_id === null) {
      throw movedOn;
    }
    const routine = await repositories.getActiveRoutine();
    const detail = routine === null ? null : await repositories.getRoutine(routine.id);
    const day = detail?.days.find(({ id }) => id === session.routine_day_id);
    if (day === undefined) {
      throw movedOn;
    }
    const { nextSet } = planProgress(scaffoldSession(day), session.sets);
    if (nextSet?.exerciseId !== exerciseId || nextSet.setNumber !== setNumber) {
      throw movedOn;
    }

    const earlier = await repositories.getLastPerformance(exerciseId, {
      excludeSessionId: sessionId,
    });
    const values = setValuesOfPrefill(
      prefillNextSet(
        exerciseId,
        session.sets,
        earlier.flatMap(({ sets }) => sets),
      ),
    );
    if (values === null) {
      throw new WidgetActionError("log_set", "nothing_to_log");
    }
    const tapped = now();
    const written = await repositories.addSet({
      sessionId,
      exerciseId,
      draft: setDraftOfValues(values, "kg"),
      unit: "kg",
      effortMode: "rir",
      now: tapped,
    });
    await bridge.writePendingUndo({
      action: "log_set",
      rowId: written.id,
      at: tapped.toISOString(),
    });
    await bridge.requestRedraw();
    return "done";
  });
}

/**
 * Removes exactly the row the last one-tap action wrote and clears the record. It does nothing when the
 * record is gone, or when its 10 minute window has closed (the stale record is dropped). A removal that
 * fails keeps the record, so the next tap tries again.
 */
export function undoLast(dependencies: WidgetActionDependencies): Promise<WidgetActionResult> {
  const { repositories, bridge, now } = dependencies;

  return run("undo", dependencies, async () => {
    const record = await bridge.readPendingUndo();
    if (record === null) {
      return "ignored";
    }
    if (!isUndoWindowOpen(record.at, now())) {
      await bridge.clearPendingUndo();
      await bridge.requestRedraw();
      return "ignored";
    }
    try {
      if (record.action === "log_again") {
        await repositories.softDeleteLogEntry(record.rowId);
      } else {
        await repositories.removeSet(record.rowId);
      }
    } catch (error) {
      if (!isRowGone(error)) {
        throw error;
      }
      // The row is gone already, so there is nothing to undo and the record has done its job.
      await bridge.clearPendingUndo();
      await bridge.requestRedraw();
      return "ignored";
    }
    await bridge.clearPendingUndo();
    await bridge.requestRedraw();
    return "done";
  });
}
