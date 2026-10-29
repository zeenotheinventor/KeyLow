import { describeRemoveItem, describeShoppingItemCaption } from "@keylow/core/copy";
import { X } from "lucide-react";
import { useId } from "react";

import type { ShoppingItemRowProps } from "./types";

import { Checkbox } from "@/components/ui/Checkbox";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/utils";

/**
 * One item of the shopping list, inside a `GroupedList`: a box named by the item, with the amount and
 * the recipes it came from under it, and a button that removes it. The line under the name describes
 * the box, so a screen reader hears it with the name. A ticked item is struck through and muted.
 */
export function ShoppingItemRow({ item, disabled, onToggle, onRemove }: ShoppingItemRowProps) {
  const captionId = useId();
  const caption = describeShoppingItemCaption(item);
  const isTicked = item.checked_at !== null;

  return (
    <li className="flex min-h-[56px] items-center gap-3 px-3 py-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <Checkbox
          label={item.name}
          checked={isTicked}
          disabled={disabled}
          aria-describedby={caption === null ? undefined : captionId}
          onChange={(event) => {
            onToggle(event.target.checked);
          }}
          className={cn("min-w-0 break-words", isTicked && "text-text-muted line-through")}
        />
        {caption !== null && (
          <p id={captionId} className="-mt-2 pb-1 pl-7 text-caption text-text-muted">
            {caption}
          </p>
        )}
      </div>
      <IconButton
        icon={X}
        label={describeRemoveItem(item.name)}
        disabled={disabled}
        onClick={onRemove}
      />
    </li>
  );
}
