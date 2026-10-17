import { describeEditFood, describeRemoveIngredient } from "@keylow/core/copy";
import { Pencil, X } from "lucide-react";

import type { IngredientRowActionsProps } from "./types";

import { IconButton } from "@/components/ui/IconButton";

/**
 * The Edit and Remove buttons of an ingredient row, which the table's actions cell and the stacked row's
 * end both hold. Each is named for its ingredient, since a page of rows has many of them.
 */
export function IngredientRowActions({
  name,
  onEdit,
  onRemove,
  disabled = false,
}: IngredientRowActionsProps) {
  return (
    <>
      <IconButton
        icon={Pencil}
        label={describeEditFood(name)}
        disabled={disabled}
        onClick={(event) => {
          onEdit(event.currentTarget);
        }}
      />
      <IconButton
        icon={X}
        label={describeRemoveIngredient(name)}
        disabled={disabled}
        onClick={(event) => {
          onRemove(event.currentTarget);
        }}
      />
    </>
  );
}
