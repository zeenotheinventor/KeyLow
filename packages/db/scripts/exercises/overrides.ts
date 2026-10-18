// Reads data/exercises/overrides.csv: the hand decisions the rules cannot make. Every row carries a
// note, which becomes the curated row's override_note (or the excluded row's reason), so a reviewer
// sees each hand decision next to the data it changed.
import { OVERRIDE_COLUMNS } from "./columns";
import { isMuscleId, isRole } from "./muscles";
import { parseMuscleShares } from "./muscleShares";
import { parseCsv } from "../cofid/csv";

import type { MuscleShare, RawMuscleShare } from "./muscleShares";

/**
 * - `map` replaces the rule-based muscles of an exercise the rules keep.
 * - `include` keeps an exercise the category rules would leave out; muscles are optional, and the rules map it when they are blank.
 * - `exclude` leaves out an exercise the rules would keep; the note is the reason.
 */
export type Override =
  | { sourceRef: string; action: "map"; muscles: MuscleShare[]; note: string }
  | { sourceRef: string; action: "include"; muscles: MuscleShare[] | undefined; note: string }
  | { sourceRef: string; action: "exclude"; note: string };

const weightPattern = /^\d+(\.\d+)?$/;

function readRawShares(text: string, where: string): RawMuscleShare[] {
  try {
    return parseMuscleShares(text);
  } catch (error) {
    throw new Error(`${where}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}

function readShares(text: string, where: string): MuscleShare[] {
  const shares = readRawShares(text, where).map(({ muscle, role, weight }) => {
    if (!isMuscleId(muscle)) {
      throw new Error(`${where}: a muscle is not one of the 22 muscle ids`);
    }
    if (!isRole(role)) {
      throw new Error(`${where}: a role is not primary, secondary or stabiliser`);
    }
    const value = Number(weight);
    if (!weightPattern.test(weight) || value <= 0 || value > 1) {
      throw new Error(`${where}: a muscle weight must be a number above 0 and at most 1`);
    }
    return { muscle, role, weight: value };
  });
  if (new Set(shares.map(({ muscle }) => muscle)).size !== shares.length) {
    throw new Error(`${where}: a muscle appears more than once`);
  }
  if (!shares.some(({ role }) => role === "primary")) {
    throw new Error(`${where}: no muscle has the primary role`);
  }
  return shares;
}

export function parseOverrides(csv: string): Map<string, Override> {
  const [header, ...rows] = parseCsv(csv);
  if (header?.join(",") !== OVERRIDE_COLUMNS.join(",")) {
    throw new Error(`overrides.csv: the header is not ${OVERRIDE_COLUMNS.join(",")}`);
  }

  const overrides = new Map<string, Override>();
  rows.forEach((row, index) => {
    const where = `overrides.csv line ${index + 2}`;
    if (row.length !== OVERRIDE_COLUMNS.length) {
      throw new Error(`${where}: expected ${OVERRIDE_COLUMNS.length} fields, found ${row.length}`);
    }
    const [sourceRef = "", action = "", muscles = "", note = ""] = row;
    if (sourceRef === "" || note === "") {
      throw new Error(`${where}: source_ref and note must not be empty`);
    }
    if (overrides.has(sourceRef)) {
      throw new Error(`${where}: a second override for one exercise`);
    }

    if (action === "map") {
      overrides.set(sourceRef, { sourceRef, action, muscles: readShares(muscles, where), note });
    } else if (action === "include") {
      const shares = muscles === "" ? undefined : readShares(muscles, where);
      overrides.set(sourceRef, { sourceRef, action, muscles: shares, note });
    } else if (action === "exclude") {
      if (muscles !== "") {
        throw new Error(`${where}: an exclude row takes no muscles`);
      }
      overrides.set(sourceRef, { sourceRef, action, note });
    } else {
      throw new Error(`${where}: action "${action}" is not map, include or exclude`);
    }
  });
  return overrides;
}
