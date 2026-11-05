import { WEIGHT_SCREEN } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Plus } from "lucide-react";

import type { WeightHeaderProps } from "./types";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { Button } from "@/components/ui/Button";

// The Weight page is a row of More's Body section, so its way back leads there.
const MORE_HREF = "/more";

/**
 * The top of the Weight page as the `web-weight, page-chart` board draws it: the way back to More, the title,
 * and Add weigh-in at the end of the title's row. The How the trend works button sits before Add weigh-in
 * when the explainer is built, and shows in every state of the page like the rest of the header.
 */
export function WeightHeader({ onAdd, addButtonRef }: WeightHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      {/* The board draws the link 44 high with 8 px off its top and bottom in the flow, so its target is 44 and the title sits as drawn. */}
      <div className="-my-2 flex">
        <BackToFoodsLink tone="accent" label={WEIGHT_SCREEN.backLabel} href={MORE_HREF} />
      </div>
      {/* The row is as tall as its buttons, 40, so the title does not move when Add weigh-in arrives. */}
      <div className="flex min-h-control-md items-center justify-between gap-3">
        <h1 className="text-h1">{WEIGHT_SCREEN.title}</h1>
        {onAdd !== undefined && (
          <Button ref={addButtonRef} onClick={onAdd}>
            <Plus aria-hidden strokeWidth={iconStroke} />
            {WEIGHT_SCREEN.addLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
