import { FOOD_DETAIL } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Pencil } from "lucide-react";
import Link from "next/link";

import type { FoodHeaderProps } from "./types";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

/** The name of the food with where it came from, and Edit beside it for a food the user made. */
export function FoodHeader({ food }: FoodHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="text-h1">{food.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge kind="source" source={food.source} />
          {food.brand !== null && (
            <span className="text-body text-text-secondary">{food.brand}</span>
          )}
        </div>
      </div>
      {food.source === "user" && (
        <Button asChild variant="secondary" className="shrink-0 [&_svg]:size-[18px]">
          <Link href={`/foods/${food.id}/edit`}>
            <Pencil aria-hidden strokeWidth={iconStroke} />
            {FOOD_DETAIL.edit}
          </Link>
        </Button>
      )}
    </div>
  );
}
