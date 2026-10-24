import {
  PROGRAM_SETTLING,
  describeFirstCheckInBanner,
  describeSettlingTipFor,
} from "@keylow/core/copy";

import type { SettlingChecklistProps, SettlingChecklistView } from "./types";
import type { FirstCheckinReadiness } from "@keylow/core/program";

type BuildSettlingChecklistViewInput = Pick<
  SettlingChecklistProps,
  "firstCheckinDate" | "daysLeft"
> & { readiness: FirstCheckinReadiness };

/**
 * What the settling banner writes, from the readiness core worked out. The labels and names are core's copy, in
 * the order of the counts, and the targets are the readiness's, which are the engine's.
 */
export function buildSettlingChecklistView({
  firstCheckinDate,
  daysLeft,
  readiness,
}: BuildSettlingChecklistViewInput): SettlingChecklistView {
  const { targets } = readiness;
  const figures = [
    { count: readiness.weighDays, target: targets.weighDays },
    { count: readiness.coverDays, target: targets.coverDays },
    { count: readiness.completeDays, target: targets.completeDays },
  ];

  return {
    title: describeFirstCheckInBanner(firstCheckinDate, daysLeft),
    rows: PROGRAM_SETTLING.needs.flatMap(({ label, name }, index) => {
      const figure = figures[index];
      return figure === undefined ? [] : [{ label, name, ...figure }];
    }),
    tip: describeSettlingTipFor(firstCheckinDate, readiness.tipDate),
  };
}
