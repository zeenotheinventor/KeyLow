import { NOT_GIVEN, describeShareOfEnergy } from "@keylow/core/copy";
import { formatGrams } from "@keylow/core/format";

import type { MacroTileProps } from "./types";

import { cn } from "@/lib/utils";

// Each class is written out whole so Tailwind can see it.
const dotClasses = {
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
} as const satisfies Record<MacroTileProps["colour"], string>;

/** One macro of the energy card: its name, its amount in grams and its share of the energy. */
export function MacroTile({ label, colour, grams, share }: MacroTileProps) {
  return (
    <div className="flex flex-col gap-1 rounded-medium bg-surface-raised px-3 py-[10px]">
      <dt className="flex items-center gap-1.5 text-caption text-text-secondary">
        <span aria-hidden className={cn("size-2 rounded-[2px]", dotClasses[colour])} />
        {label}
      </dt>
      <dd
        className={cn(
          "text-numeral-small",
          grams === null ? "text-text-muted" : "text-text-primary",
        )}
      >
        {grams === null ? NOT_GIVEN : `${formatGrams(grams)} g`}
      </dd>
      {share !== null && (
        <dd className="text-caption text-text-muted">{describeShareOfEnergy(share)}</dd>
      )}
    </div>
  );
}
