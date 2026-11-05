import { WEIGHT_SCREEN } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Info, Plus } from "lucide-react";
import { useState } from "react";

import { TrendExplainerDialog } from "../TrendExplainerDialog";

import type { WeightHeaderProps } from "./types";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { Button } from "@/components/ui/Button";

// The Weight page is a row of More's Body section, so its way back leads there.
const MORE_HREF = "/more";

/**
 * The top of the Weight page as the `web-weight, page-chart` board draws it: the way back to More, the title,
 * and the How the trend works button and Add weigh-in at the end of the title's row. The button shows in every
 * state of the page like the rest of the header, and opens the trend explainer, which this header holds open
 * or closed. It is not a route, so the page behind it keeps its place. Focus goes back to the button when
 * the dialog closes, named to the dialog because a click does not focus a button in every browser.
 */
export function WeightHeader({ onAdd, addButtonRef }: WeightHeaderProps) {
  const [infoButton, setInfoButton] = useState<HTMLButtonElement | null>(null);
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      {/* The board draws the link 44 high with 8 px off its top and bottom in the flow, so its target is 44 and the title sits as drawn. */}
      <div className="-my-2 flex">
        <BackToFoodsLink tone="accent" label={WEIGHT_SCREEN.backLabel} href={MORE_HREF} />
      </div>
      {/* The row is as tall as its buttons, 40, so the title does not move when Add weigh-in arrives. */}
      <div className="flex min-h-control-md items-center justify-between gap-3">
        <h1 className="text-h1">{WEIGHT_SCREEN.title}</h1>
        <div className="flex items-center gap-2">
          <Button
            ref={setInfoButton}
            variant="ghost"
            iconOnly
            className="text-text-secondary"
            aria-label={WEIGHT_SCREEN.explainerLabel}
            onClick={() => {
              setIsExplainerOpen(true);
            }}
          >
            <Info aria-hidden strokeWidth={iconStroke} />
          </Button>
          {onAdd !== undefined && (
            <Button ref={addButtonRef} onClick={onAdd}>
              <Plus aria-hidden strokeWidth={iconStroke} />
              {WEIGHT_SCREEN.addLabel}
            </Button>
          )}
        </div>
      </div>
      {isExplainerOpen && (
        <TrendExplainerDialog
          returnFocusTo={infoButton}
          onClose={() => {
            setIsExplainerOpen(false);
          }}
        />
      )}
    </div>
  );
}
