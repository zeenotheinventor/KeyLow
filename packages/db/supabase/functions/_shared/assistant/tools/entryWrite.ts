// What the three diary write tools share: when an entry is logged, the answer for an input the
// database cannot honour, and how Undo tells that the person changed an entry since the assistant did.
import { clockTimeOn, formatClockTime } from "../../core.ts";

import type { ActionRecord } from "../store.ts";
import type { ToolContext, WriteRunOutput } from "../tool.ts";

// The turn's day and hour unless the person named another. The hour belongs to the turn's day, so a
// day named without a time takes the clock time of the moment the turn ran.
export function momentOf(
  ctx: ToolContext,
  named: { local_date: string | null; time: string | null },
  timeZone: string,
) {
  const day = named.local_date ?? ctx.turn.localDate;
  const clock = named.time ?? ctx.turn.localTime ?? formatClockTime(new Date(), timeZone);
  return clockTimeOn(day, clock, timeZone);
}

// The same shape the executor answers for a schema failure, for a check that needs the database: the
// model reads it the same way and corrects the named field. Nothing was written, so no action is kept.
export const invalidInput = (fields: string[]): WriteRunOutput => ({
  data: { error: "invalid_input", fields },
  target: null,
});

export const notFound: WriteRunOutput = { data: { error: "not_found" }, target: null };

const sameInstant = (first: string, second: string): boolean =>
  Date.parse(first) === Date.parse(second);

// Undo only runs on entries as the assistant left them. The database stamps `updated_at` on every
// change, so a stamp that differs from the one recorded means the person edited, deleted or restored
// the entry since. A write whose stamp could not be read has nothing to compare, so it is not undone.
export function leftAsWritten(
  states: readonly { updatedAt: string; isDeleted: boolean }[],
  action: ActionRecord,
  expect: { count: number; deleted: boolean },
): boolean {
  const { targetUpdatedAt } = action;
  return (
    targetUpdatedAt !== null &&
    states.length === expect.count &&
    states.every(
      (state) =>
        state.isDeleted === expect.deleted && sameInstant(state.updatedAt, targetUpdatedAt),
    )
  );
}

export const targetIdsOf = (action: ActionRecord): string[] => [
  ...(action.targetId === null ? [] : [action.targetId]),
  ...(action.targetIds ?? []),
];
