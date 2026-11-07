import { z } from "zod";

/*
 * Why the assistant cannot take a turn, or why the last one failed (M8 plan, section 5, "AssistantNotice
 * codes"). One member per code, so the day limit always carries the instant it resets at and resting
 * always carries the day it resumes on, and no other code carries either. The words for each code are
 * in `copy/assistantNotices.ts`.
 */
export const assistantNoticeSchema = z.discriminatedUnion("code", [
  /** The person has not turned the assistant on (`assistant · consent-needed`). */
  z.strictObject({ code: z.literal("consent_needed") }),
  /**
   * Today's turns are used (`assistant · day-limit`). `resetsAt` is the next midnight UTC as an ISO
   * instant, never a worded time, because the app words it in the person's time zone.
   */
  z.strictObject({ code: z.literal("day_limit"), resetsAt: z.iso.datetime({ offset: true }) }),
  /** The account has no Ki-Lo Plus entitlement (`assistant · plus`). */
  z.strictObject({ code: z.literal("plus") }),
  /** This month's spend has reached its limit (`assistant · resting`), until `resumesOn`, `YYYY-MM-DD`. */
  z.strictObject({ code: z.literal("resting"), resumesOn: z.iso.date() }),
  /** The kill switch is on (`assistant · unavailable`, left). */
  z.strictObject({ code: z.literal("switched_off") }),
  /** The turn failed and nothing was changed (`assistant · unavailable`, middle). */
  z.strictObject({ code: z.literal("turn_failed") }),
  /**
   * A button the person pressed to confirm a change was refused because a workout is in progress
   * (`assistant · workout-in-progress`). Nothing was changed, and the confirmation is not spent. Questions
   * still work, so the composer stays on.
   */
  z.strictObject({ code: z.literal("workout_in_progress") }),
]);

export type AssistantNotice = z.infer<typeof assistantNoticeSchema>;
export type AssistantNoticeCode = AssistantNotice["code"];
