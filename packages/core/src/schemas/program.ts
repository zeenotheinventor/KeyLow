import { z } from "zod";

import { CALORIE_GOALS } from "../engine/types";

/*
 * The two jsonb key sets of the weekly check-in: a snapshot's `measurement` (ADR 0002, Amendment 2,
 * "The measurement" and "The update") and a targets row's `basis` ("Key sets and the 6000 cap"), as
 * ADR 0003, Amendment 13, stores them. Every key the ADR names is required and keeps its type, so a
 * missing or mistyped key is a malformed row, and so is an update field on an ineligible measurement.
 * Readers tolerate what they do not know: an extra key is dropped and an unknown clamp is kept, because
 * a key the server adds later must not break every installed older bundle. Both are health data, so no
 * message here quotes a value, and a caller reports the field paths only.
 */

const MIN_Z_KCAL = 800;
const MAX_Z_KCAL = 6000;
const DAYS_IN_WEEK = 7;

const dayCountSchema = z.number().int().min(0);

const measurementCountsShape = {
  spanDays: dayCountSchema,
  weighDays: dayCountSchema,
  completeDays: dayCountSchema,
};

/** Why a window did not measure, in the order the rules are checked. */
const INELIGIBILITY_REASONS = ["span", "weigh_days", "complete_days"] as const;

const ineligibleMeasurementSchema = z.object({
  eligible: z.literal(false),
  reasons: z.array(z.enum(INELIGIBILITY_REASONS)),
  ...measurementCountsShape,
  // The update fields belong to an eligible measurement only: present here, they are a malformed row.
  gain: z.never().optional(),
  rawStepKcal: z.never().optional(),
  stepKcal: z.never().optional(),
  stepClamped: z.never().optional(),
});

const eligibleMeasurementSchema = z.object({
  eligible: z.literal(true),
  /** The expenditure the window implies, clamped by the engine to 800 to 6000. */
  zKcal: z.number().min(MIN_Z_KCAL).max(MAX_Z_KCAL),
  rKcal2: z.number(),
  slopeKgPerDay: z.number(),
  seSlopeKg: z.number(),
  meanIntakeKcal: z.number(),
  ...measurementCountsShape,
  // The update fields of `updateExpenditure`, which an eligible measurement always carries.
  gain: z.number(),
  rawStepKcal: z.number(),
  stepKcal: z.number(),
  stepClamped: z.boolean(),
});

/**
 * A snapshot's `measurement`, a union on `eligible`. An ineligible measurement says why and has no update
 * fields. An eligible one holds the measurement and the update fields of the check-in step.
 */
export const expenditureMeasurementSchema = z.discriminatedUnion("eligible", [
  eligibleMeasurementSchema,
  ineligibleMeasurementSchema,
]);

export type ExpenditureMeasurement = z.infer<typeof expenditureMeasurementSchema>;

/** What the targets of a row were worked out from: where they came from and the numbers that decided them. */
export const targetsBasisSchema = z.object({
  source: z.enum(["start", "checkin", "recompute"]),
  tdeeKcal: z.number(),
  trendWeightKg: z.number(),
  bmrKcal: z.number(),
  goal: z.enum(CALORIE_GOALS),
  ratePctPerWeek: z.number(),
  /** The true signed rate, negative when the floor lifts a lose target above expenditure. */
  effectiveRatePctPerWeek: z.number(),
  proteinGPerKg: z.number(),
  fatFraction: z.number(),
  dowOffsetsKcal: z.array(z.number()).length(DAYS_IN_WEEK),
  /** The engine's clamps and the setup layer's `profile_max`. A code this build does not know is kept, not refused. */
  clamps: z.array(z.string()),
});

export type TargetsBasis = z.infer<typeof targetsBasisSchema>;
