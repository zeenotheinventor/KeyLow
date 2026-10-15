"use client";

import { useTargets } from "@keylow/api-client";
import { MORE_SCREEN } from "@keylow/core/copy";
import { formatCalories } from "@keylow/core/format";

import { ListRow } from "@/components/ui/ListRow";

/** The Targets row of More: it opens the Targets page and shows the calorie target once one is set. */
export function TargetsRow() {
  const targets = useTargets();
  const kcal = targets.data?.kcal ?? null;

  return (
    <ListRow
      title={MORE_SCREEN.nutrition.targets.title}
      subtitle={MORE_SCREEN.nutrition.targets.subtitle}
      value={kcal === null ? undefined : `${formatCalories(kcal)} kcal`}
      href="/more/targets"
    />
  );
}
