/**
 * The shape version of a stored `SetSnapshot` (ADR 0005, Amendment 1, "The set snapshot"). It is separate
 * from the food `SNAPSHOT_VERSION`, which does not move. Bump it when the set snapshot shape changes.
 */
export const SET_SNAPSHOT_VERSION = 1;
