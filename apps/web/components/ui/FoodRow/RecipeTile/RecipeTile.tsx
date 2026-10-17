import { iconStroke } from "@keylow/tokens";
import { ChefHat } from "lucide-react";

/** The square at the start of a recipe row, with the chef's hat in it. It is decoration. */
export function RecipeTile() {
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-small bg-surface-raised text-text-secondary"
    >
      <ChefHat className="size-5" strokeWidth={iconStroke} />
    </span>
  );
}
