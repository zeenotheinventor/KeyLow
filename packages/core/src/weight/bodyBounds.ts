/*
 * The figures the body composition amendment of ADR 0003 sets for body fat and lean mass. The
 * migration writes the same ones into its checks, and if they ever differ the amendment's table wins.
 */

/** The lowest body fat a measurement can hold, in per cent of body weight, inclusive. */
export const BODY_FAT_MIN_PCT = 1;

/** The highest body fat a measurement can hold, in per cent of body weight, inclusive. */
export const BODY_FAT_MAX_PCT = 75;

/** The lightest lean mass a measurement can hold, in kilograms, inclusive. */
export const LEAN_MASS_MIN_KG = 10;

/** The heaviest lean mass a measurement can hold, in kilograms, inclusive. */
export const LEAN_MASS_MAX_KG = 300;
