import { NOT_GIVEN, PORTION_PICKER, describeShareOfEnergy } from "@keylow/core/copy";
import { formatEnergyShare, formatGrams } from "@keylow/core/format";

import type { MacroTileProps } from "./types";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

// Each class is written out whole so Tailwind can see it.
const dotClasses = {
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
} as const satisfies Record<MacroTileProps["colour"], string>;

/**
 * One macro of the energy card: its name, its amount in grams and its share of the energy. In the
 * `amount` variant the tile is a row below 700 px, with the value, the name and the share pill at the
 * end, and a column from 700 px with the pill first, as the dialogs' boards draw it.
 */
export function MacroTile({
  label,
  colour,
  grams,
  share,
  variant = "detail",
  isBlank = false,
}: MacroTileProps) {
  const isAmount = variant === "amount";

  return (
    <div
      className={cn(
        "rounded-medium bg-surface-raised px-3",
        isAmount
          ? "flex flex-row items-center gap-3 py-2 min-[700px]:flex-col min-[700px]:items-stretch min-[700px]:gap-1"
          : "flex flex-col gap-1 py-[10px]",
      )}
    >
      <dt
        className={cn(
          "flex items-center gap-1.5 text-caption text-text-secondary",
          isAmount && "order-2",
        )}
      >
        <span aria-hidden className={cn("size-2 rounded-[2px]", dotClasses[colour])} />
        {label}
      </dt>
      <dd
        className={cn(
          "text-numeral-small",
          isAmount && "order-1",
          grams === null || isBlank ? "text-text-muted" : "text-text-primary",
        )}
      >
        {isBlank ? PORTION_PICKER.noValue : grams === null ? NOT_GIVEN : `${formatGrams(grams)} g`}
      </dd>
      {share !== null && !isBlank && !isAmount && (
        <dd className="text-caption text-text-muted">{describeShareOfEnergy(share)}</dd>
      )}
      {share !== null && !isBlank && isAmount && (
        <dd className="order-3 ml-auto min-[700px]:order-none min-[700px]:ml-0 min-[700px]:self-start">
          <Badge className="border-border">
            {formatEnergyShare(share)}
            <span className="sr-only"> of energy</span>
          </Badge>
        </dd>
      )}
    </div>
  );
}
