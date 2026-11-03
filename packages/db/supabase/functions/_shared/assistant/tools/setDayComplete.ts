// Marks a diary day complete or not, as the Diary's own switch does. A call that leaves the day as it
// was records no action. `assistant_actions` holds no value, so the day tells Undo which way the call
// went: a call that completed the day records the instant it was completed, and a call that marked it
// incomplete records none. Undo flips the day back only while it is still as the call left it.
import { z } from "zod";

import { buildDayCompletedCard } from "../../core.ts";
import { getDiaryDay, setDayComplete } from "../../repos.ts";
import { localDateSchema } from "./shared.ts";

import type { WriteRunOutput, WriteToolDefinition } from "../tool.ts";

const setDayCompleteInput = z.strictObject({
  local_date: localDateSchema.describe("The diary day, YYYY-MM-DD."),
  complete: z.boolean().describe("True to mark the day complete, false to mark it not complete."),
});

type SetDayCompleteInput = z.infer<typeof setDayCompleteInput>;

const sameInstant = (first: string, second: string): boolean =>
  Date.parse(first) === Date.parse(second);

export const setDayCompleteTool: WriteToolDefinition<SetDayCompleteInput> = {
  name: "set_day_complete",
  description:
    "Marks a diary day complete or not complete, with Undo. A complete day counts towards the user's " +
    "expenditure estimate. A day already in the state asked for is left as it is.",
  kind: "write",
  input: setDayCompleteInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  targetTable: "day_logs",
  async run(ctx, { local_date, complete }): Promise<WriteRunOutput> {
    const before = (await getDiaryDay(ctx.caller, local_date)).dayLog?.is_complete ?? false;
    if (before === complete) {
      return { data: { local_date, complete, changed: false }, target: null };
    }
    await setDayComplete(ctx.caller, local_date, complete);

    // The write has landed. Nothing below may throw.
    let completedAt: string | null = null;
    if (complete) {
      try {
        completedAt = (await getDiaryDay(ctx.caller, local_date)).dayLog?.completed_at ?? null;
      } catch (caught) {
        ctx.reportError("assistant tool set_day_complete", "internal_error", caught);
      }
    }
    return {
      data: { local_date, complete, changed: true },
      structured: { card: buildDayCompletedCard({ localDate: local_date, complete }) },
      target: {
        targetLocalDate: local_date,
        ...(completedAt === null ? {} : { targetUpdatedAt: completedAt }),
      },
    };
  },
  async inverse(ctx, action) {
    if (action.targetLocalDate === null) {
      return "unavailable";
    }
    const { dayLog } = await getDiaryDay(ctx.caller, action.targetLocalDate);
    const isComplete = dayLog?.is_complete ?? false;
    if (action.targetUpdatedAt === null) {
      // The call marked the day incomplete, so it must still be.
      if (isComplete) {
        return "unavailable";
      }
      await setDayComplete(ctx.caller, action.targetLocalDate, true);
      return "undone";
    }
    // The call completed the day, so it must still be complete from the same moment.
    if (
      !isComplete ||
      dayLog?.completed_at == null ||
      !sameInstant(dayLog.completed_at, action.targetUpdatedAt)
    ) {
      return "unavailable";
    }
    await setDayComplete(ctx.caller, action.targetLocalDate, false);
    return "undone";
  },
};
