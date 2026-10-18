import { z } from "zod";

import { HEAT_STEP_CUTS_V1 } from "./bodyMapValues";
import { parseMoment } from "./muscleState";

/*
 * What the muscle list and the muscle sheet both write about a muscle's heat: the rounded percent, its
 * step and the whole hours until it is ready. Pure, and held to the sheet and list boards of the
 * canvas, so the two surfaces can never read one muscle two ways.
 */

const MILLISECONDS_PER_HOUR = 3_600_000;

const timestampSchema = z.iso.datetime({ offset: true });

/** An instant as epoch milliseconds, or a `RangeError` naming `rule` when it has no zone or is no timestamp. */
export const parseInstant = (timestamp: string, rule: string): number => {
  if (!timestampSchema.safeParse(timestamp).success) {
    throw new RangeError(rule);
  }
  return Date.parse(timestamp);
};

/** A muscle's heat, from 0 to 1, as a whole percent. Half a percent rounds up. */
export const heatPercentOf = (heat: number): number => Math.round(heat * 100);

/** The step, from 0 to 5, that a whole heat percent falls in. */
export const heatStepOf = (heatPercent: number): number =>
  HEAT_STEP_CUTS_V1.filter((cut) => heatPercent >= cut).length;

/**
 * The whole hours from `now` until `readyAt`, to the nearest hour, and 0 when the muscle is ready already.
 * A muscle that is not ready yet reads at least 1, so "ready now" is never written for a muscle that is
 * still a few minutes away.
 *
 * Throws a `RangeError` naming the rule when either is not an ISO timestamp with a zone.
 */
export const readyInHoursOf = (readyAt: string, now: string): number => {
  const milliseconds =
    parseInstant(readyAt, "A ready time must be an ISO timestamp with a zone") - parseMoment(now);
  if (milliseconds <= 0) {
    return 0;
  }
  return Math.max(1, Math.round(milliseconds / MILLISECONDS_PER_HOUR));
};
