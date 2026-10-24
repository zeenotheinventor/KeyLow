import { z } from "zod";

/*
 * The contract of the `run-checkin` Edge Function (ADR 0002, Amendment 2, "`run-checkin`"). The `due` and
 * `recompute` modes exist so far. `backstop` joins the mode list with its own ticket, and until then a
 * body that names it is refused as a bad mode. The error codes the function sends are in
 * `edgeErrorCodeSchema`, beside every other function's.
 */

/** What a call asks for. Both modes run for the caller's own program. */
const runCheckinModeSchema = z.enum(["due", "recompute"]);

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

/** Response body of the `run-checkin` Edge Function in `recompute` mode: the id of the new targets row. */
export const runCheckinRecomputeResponseSchema = z.object({
  targetsId: z.uuid(),
});

export type RunCheckinRequest = z.infer<typeof runCheckinRequestSchema>;
export type RunCheckinResponse = z.infer<typeof runCheckinResponseSchema>;
export type RunCheckinRecomputeResponse = z.infer<typeof runCheckinRecomputeResponseSchema>;
