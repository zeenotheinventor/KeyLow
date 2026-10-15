/** The shape version of a stored `FoodSnapshot`. Bump it when the snapshot shape changes. */
export const SNAPSHOT_VERSION = 1;

/** The version of the maths that turns a snapshot into `nutrients` (unit resolution and scaling). */
export const NUTRITION_ENGINE_VERSION = 1;

/*
 * Spoons, millilitres by estimated density and the density estimate (KEY-257, KEY-258) did not bump
 * NUTRITION_ENGINE_VERSION. The maths from a snapshot to its nutrients is unchanged: a spoon is a portion
 * in millilitres, and the density is an input frozen into the snapshot when the entry is logged, never
 * looked up again, so the same snapshot still gives the same numbers.
 */
