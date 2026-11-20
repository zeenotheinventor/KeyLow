import type { HeldRow } from "./celebrations";

/** The held rows the person has not looked at yet, backfilled ones included, in the order given. Pure. */
export const unseenIdsOf = (held: readonly Pick<HeldRow, "id" | "seenAt">[]): string[] =>
  held.filter(({ seenAt }) => seenAt === null).map(({ id }) => id);

/**
 * The held rows the live sync recorded quietly as a backfill that the person has not looked at yet. They are
 * the badges the one summary card counts. Pure.
 */
export const unseenBackfilledIdsOf = (held: readonly HeldRow[]): string[] =>
  held.filter(({ seenAt, backfilled }) => backfilled && seenAt === null).map(({ id }) => id);

/**
 * The rows with the given ids stamped seen at `seenAt`, for a screen that shows the write before the database
 * has answered. A row already seen keeps its stamp, as `markAchievementsSeen` leaves it, and the rows are not
 * changed in place. Pure.
 */
export const withSeen = <Row extends Pick<HeldRow, "id" | "seenAt">>(
  held: readonly Row[],
  ids: readonly string[],
  seenAt: string,
): Row[] =>
  held.map((row) => (row.seenAt === null && ids.includes(row.id) ? { ...row, seenAt } : row));

/**
 * The notified ids still worth remembering: those no held row says the person has seen. An id no row holds
 * yet stays, because the notification can be recorded before a read that predates the row. Pure.
 */
export const stillNotifiedIds = (
  notified: readonly string[],
  held: readonly Pick<HeldRow, "id" | "seenAt">[],
): string[] => {
  const seenIds = new Set(held.filter(({ seenAt }) => seenAt !== null).map(({ id }) => id));
  return notified.filter((id) => !seenIds.has(id));
};
