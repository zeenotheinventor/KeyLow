import type { FoodTableProps } from "./types";

import { FoodTableHeader } from "@/components/ui/FoodTableHeader";

/**
 * An hour's logged foods at the wide width: a table with its column headings and, as its children, the
 * `FoodRow`s with `layout="table"`. It is hidden as a whole at the narrow width, where the stacked rows
 * take over, so no table without headings is left for assistive technology.
 */
export function FoodTable({ label, variant, children }: FoodTableProps) {
  return (
    <div role="table" aria-label={label} className="max-md:hidden">
      <FoodTableHeader variant={variant} />
      {children}
    </div>
  );
}
