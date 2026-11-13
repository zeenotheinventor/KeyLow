import { PALATE_SUMMARY_MAX_NAMES } from "./constants";
import {
  describeAvoidSummary,
  describeRareSummary,
  describeUsualMostDays,
  describeUsualMostWeeks,
} from "../copy/palate";

import type { PalateFrequency, PalateProfile } from "./types";

/**
 * The readable lines that sum the profile up, in this order and each only when it has something to say:
 * what is eaten on most days, what comes up most weeks, what is rarely or never logged, and what the
 * person avoids. A line names at most 4 items and a food is named once, by its short name. It reads the
 * lists a correction has already left items out of, so a corrected item is never in a line. The avoid
 * line names everything on the list, because it is what the person said and not a guess.
 */
export function summaryLines(profile: PalateProfile): string[] {
  const named = new Set<string>();
  const namesWith = (frequency: PalateFrequency): string[] => {
    const names: string[] = [];
    for (const food of profile.usualFoods) {
      if (food.frequency === frequency && !named.has(food.shortName)) {
        named.add(food.shortName);
        names.push(food.shortName);
      }
    }
    return names.slice(0, PALATE_SUMMARY_MAX_NAMES);
  };

  const mostDays = namesWith("most days");
  const mostWeeks = namesWith("most weeks");
  const rare = profile.rarelyOrNever.map(({ group }) => group).slice(0, PALATE_SUMMARY_MAX_NAMES);

  return [
    mostDays.length > 0 ? describeUsualMostDays(mostDays) : null,
    mostWeeks.length > 0 ? describeUsualMostWeeks(mostWeeks) : null,
    rare.length > 0 ? describeRareSummary(rare) : null,
    profile.avoid.length > 0 ? describeAvoidSummary(profile.avoid) : null,
  ].flatMap((line) => (line === null ? [] : [line]));
}
