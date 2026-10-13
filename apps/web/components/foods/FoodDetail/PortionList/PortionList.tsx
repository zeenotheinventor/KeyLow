import type { PortionListProps } from "./types";
import type { FoodPortion } from "@keylow/core/schemas";

import { formatAmount } from "@/components/foods/foodDisplay";

/** A portion is a weight or a volume, never both, so exactly one of the two is set. */
function describeAmount({ grams, ml }: Pick<FoodPortion, "grams" | "ml">) {
  if (grams !== null) {
    return `${formatAmount(grams)} g`;
  }
  return ml === null ? "" : `${formatAmount(ml)} ml`;
}

export function PortionList({ portions }: PortionListProps) {
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {portions.map((portion) => (
        <li key={portion.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
          <span className="font-medium">{portion.label}</span>
          <span className="text-text-muted">{describeAmount(portion)}</span>
          {portion.is_default && (
            <span className="rounded-full border px-2 py-0.5 text-xs">Default</span>
          )}
        </li>
      ))}
    </ul>
  );
}
