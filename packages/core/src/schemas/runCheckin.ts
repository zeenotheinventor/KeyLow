import { z } from "zod";

/*
 * The contract of the `run-checkin` Edge Function (ADR 0002, Amendment 2, "`run-checkin`"). Only the
 * `due` mode exists so far. `recompute` and `backstop` join the mode list with their own tickets, and
 * until then a body that names them is refused as a bad mode.
 */

/**
 * The error codes only `run-checkin` sends, beside the shared `EdgeErrorCode`s: a mode it does not know
 * (400), a user with no active program (409) and a program whose profile lacks a stat a check-in needs
 * (409). They are kept apart from `edgeErrorCodeSchema` for now, because the user-facing sentence for each
 * shared code lives in `copy/errors.ts`. Folding them into that schema comes with their sentences.
 */
export const runCheckinErrorCodeSchema = z.enum(["bad_mode", "no_program", "missing_stats"]);

/** What a call asks for. Only the caller's own due check-ins are available. */
const runCheckinModeSchema = z.literal("due");

/** Request body of the `run-checkin` Edge Function. A body with no mode asks for `due`. */
export const runCheckinRequestSchema = z.object({
  mode: runCheckinModeSchema.optional(),
});

/**
 * Response body of the `run-checkin` Edge Function in `due` mode. `ran` counts the check-ins this call
 * recorded, not the ones another caller got to first. `nextCheckinDate` is the program's stored date
 * after the run, `YYYY-MM-DD`, or null when the program has none.
 */
export const runCheckinResponseSchema = z.object({
  ran: z.number().int().min(0),
  nextCheckinDate: z.iso.date().nullable(),
});

export type RunCheckinErrorCode = z.infer<typeof runCheckinErrorCodeSchema>;
export type RunCheckinRequest = z.infer<typeof runCheckinRequestSchema>;
export type RunCheckinResponse = z.infer<typeof runCheckinResponseSchema>;
