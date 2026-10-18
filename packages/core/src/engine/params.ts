/*
 * Every tunable of the adaptive engine in one object, so that a retune is a new version and never an
 * edit that rewrites history. Anything computed with these params records their version. M6 extends
 * `EngineParams` with the expenditure and target params. Nothing for them is added here yet.
 */

/** The version every `EngineParams` carries. */
export const ENGINE_VERSION = "keylow-engine-v1";

/** The tunables of the trend weight. */
export type TrendParams = Readonly<{
  /** The EWMA smoothing factor, between 0 and 1. A larger value follows the readings more closely. */
  alpha: number;
  /** Every reading is clamped to this fraction either side of the last trend (0.025 is 2.5%). */
  winsorPct: number;
  /** A reading further than this fraction from the last trend can be rejected as a spike. */
  rejectPct: number;
  /** Accepted readings a segment needs before spikes are rejected or clamped. */
  winsorMinObs: number;
  /** A gap of more than this many calendar days between two reading dates starts a new segment. */
  maxGapDays: number;
}>;

export type EngineParams = Readonly<{
  version: typeof ENGINE_VERSION;
  trend: TrendParams;
}>;

export const DEFAULT_ENGINE_PARAMS: EngineParams = {
  version: ENGINE_VERSION,
  trend: { alpha: 0.1, winsorPct: 0.025, rejectPct: 0.15, winsorMinObs: 5, maxGapDays: 30 },
};
