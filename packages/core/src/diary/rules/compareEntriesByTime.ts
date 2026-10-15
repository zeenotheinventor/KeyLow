/** The part of a `food_log_entries` row that decides where it sits on the day's timeline. */
export type TimelineEntry = {
  logged_at: string;
  created_at: string;
  id: string;
};

/**
 * Orders a day's entries as the diary lists them (ADR 0003, Amendment 5): by `logged_at`, then
 * `created_at`, then `id`. Timestamps compare as instants, so an offset in the text cannot change
 * the order. Use it as the callback of `Array.prototype.sort`.
 */
export function compareEntriesByTime(first: TimelineEntry, second: TimelineEntry): number {
  return (
    parseInstant(first.logged_at) - parseInstant(second.logged_at) ||
    parseInstant(first.created_at) - parseInstant(second.created_at) ||
    compareText(first.id, second.id)
  );
}

function parseInstant(timestamp: string): number {
  const milliseconds = Date.parse(timestamp);
  if (Number.isNaN(milliseconds)) {
    throw new RangeError(`Invalid timestamp: "${timestamp}"`);
  }
  return milliseconds;
}

function compareText(first: string, second: string): number {
  if (first < second) {
    return -1;
  }
  return first > second ? 1 : 0;
}
