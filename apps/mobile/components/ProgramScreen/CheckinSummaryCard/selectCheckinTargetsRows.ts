import type { CheckinTargetsRows } from "./types";
import type { TargetsRow } from "@keylow/api-client";

/**
 * The check-in's own targets row and the one before it, from the targets history (oldest first). After an edit
 * or a recalculation the current row is a recompute row, so the card cannot take "current and previous". The
 * rows are the active programme's only (the history holds every programme's, and a row from before the programme
 * began is another's). The check-in's row is the newest one that came from a check-in and is in force from the
 * check-in's day on. Null when there is no such row, or no row of the programme before it to compare with.
 */
export function selectCheckinTargetsRows(
  history: readonly TargetsRow[],
  checkinDate: string,
  programStartedOn: string,
): CheckinTargetsRows | null {
  const ownRows = history.filter((row) => row.effectiveFrom >= programStartedOn);
  const targets = ownRows
    .filter((row) => row.basis.source === "checkin" && row.effectiveFrom >= checkinDate)
    .at(-1);
  if (targets === undefined) {
    return null;
  }
  // A row that held for no days was replaced on the day it began, so it never was the targets before.
  const previousTargets = ownRows
    .slice(0, ownRows.indexOf(targets))
    .filter((row) => row.effectiveTo !== row.effectiveFrom)
    .at(-1);

  return previousTargets === undefined ? null : { targets, previousTargets };
}
