import { FOOD_DETAIL } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Pencil } from "lucide-react";
import Link from "next/link";

import type { FoodHeaderProps } from "./types";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { useFavouriteFoodHeart } from "@/lib/favourites";

/**
 * The name of the food with where it came from, and beside it the favourite heart, then Edit for a food the
 * user made.
 */
export function FoodHeader({ food }: FoodHeaderProps) {
  const heart = useFavouriteFoodHeart(food);

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
      <div className="flex shrink-0 items-center gap-2">
        {heart !== undefined && <IconButton {...heart} />}
        {food.source === "user" && (
          <Button asChild variant="secondary" className="shrink-0 [&_svg]:size-[18px]">
            <Link href={`/foods/${food.id}/edit`}>
              <Pencil aria-hidden strokeWidth={iconStroke} />
              {FOOD_DETAIL.edit}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
