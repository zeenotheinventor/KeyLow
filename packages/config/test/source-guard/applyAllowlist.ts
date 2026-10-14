import type { RuleName, Violation } from "./types";

export type AllowlistEntry = {
  rule: RuleName;
  path: string;
  /** Narrows the entry to one finding in the file, such as a colour or a class. */
  detail?: string;
  /** How many findings the entry covers. Defaults to 1, so a second one in the same place fails. */
  count?: number;
  /** Why the exception is right. An entry without a reason is not accepted in review. */
  reason: string;
};

const covers = (entry: AllowlistEntry, violation: Violation): boolean =>
  entry.rule === violation.rule &&
  entry.path === violation.path &&
  (entry.detail === undefined || entry.detail === violation.detail);

const countOf = (entry: AllowlistEntry): number => entry.count ?? 1;

/**
 * Drops the violations the entries cover, each entry up to its count. Reports the entries that
 * covered fewer than their count, so an exception cannot outlive the thing it excused.
 */
export function applyAllowlist(
  violations: readonly Violation[],
  entries: readonly AllowlistEntry[],
): { remaining: Violation[]; unusedEntries: AllowlistEntry[] } {
  const covered = new Map<AllowlistEntry, number>(entries.map((entry) => [entry, 0]));

  const remaining = violations.filter((violation) => {
    const entry = entries.find(
      (candidate) =>
        covers(candidate, violation) && (covered.get(candidate) ?? 0) < countOf(candidate),
    );
    if (entry === undefined) {
      return true;
    }
    covered.set(entry, (covered.get(entry) ?? 0) + 1);
    return false;
  });

  return {
    remaining,
    unusedEntries: entries.filter((entry) => (covered.get(entry) ?? 0) < countOf(entry)),
  };
}
