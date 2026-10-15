import { FOOD_DETAIL } from "@keylow/core/copy";
import { formatPortionAmount } from "@keylow/core/format";

import type { PortionListProps } from "./types";
import type { FoodPortion } from "@keylow/core/schemas";

import { Badge } from "@/components/ui/Badge";
import { GroupedList } from "@/components/ui/GroupedList";

/** The amount as one string, such as "30 g", or nothing when the portion has neither a weight nor a volume. */
function describeAmount(portion: FoodPortion) {
  const amount = formatPortionAmount(portion);
  return amount === null ? "" : `${amount.amount} ${amount.unit}`;
}

export function PortionList({ portions }: PortionListProps) {
  return (
    <GroupedList title={FOOD_DETAIL.portions} headerSize="compact">
      {portions.map((portion) => (
        <li key={portion.id} className="flex min-h-[52px] items-center gap-2 px-4 py-2">
          <span className="text-body-strong">{portion.label}</span>
          {portion.is_default && <Badge>{FOOD_DETAIL.defaultPortion}</Badge>}
          <span className="ml-auto text-numeral-small">{describeAmount(portion)}</span>
        </li>
      ))}
    </GroupedList>
  );
}
