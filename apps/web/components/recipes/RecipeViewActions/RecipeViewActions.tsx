import {
  RECIPE_ACTIONS,
  RECIPE_VIEW,
  SHOPPING_LIST,
  describeArchiveRecipe,
  describeDuplicateRecipe,
  describeEditRecipe,
} from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Archive, Copy, Pencil, RefreshCw, ShoppingCart } from "lucide-react";
import Link from "next/link";

import type { RecipeViewActionsProps } from "./types";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// The boards draw the icons of these buttons at 18 px, where the small size has 16.
const ICON_CLASSES = "[&_svg]:size-[18px]";

// A disabled button takes no pointer, so it shows no hover or press feedback, and is dimmed.
const DISABLED_CLASSES = "aria-disabled:pointer-events-none aria-disabled:opacity-40";

/**
 * The buttons in the header of the recipe view, in the order the board draws them: Edit, Refresh
 * ingredients, Add to shopping list, Duplicate, then Archive. They sit in a row that wraps, to the right
 * of the title when there is room and under it when there is not. Offline, each stays focusable and says it
 * is disabled, with no handler, so neither a click nor a key press does anything. Duplicate is the same
 * until the library has been read. A busy button has no handler either, so a second press does nothing more.
 */
export function RecipeViewActions({
  name,
  editHref,
  isOnline,
  isArchived,
  isLibraryRead,
  isDuplicating,
  isArchiving,
  onRefresh,
  onAddToList,
  onDuplicate,
  onArchive,
}: RecipeViewActionsProps) {
  const editLabel = describeEditRecipe(name);
  // Until the library is read a copy cannot be named, so Duplicate is disabled until it is, as it is offline.
  const isDuplicateDisabled = !isOnline || !isLibraryRead;

  return (
    <div className="flex flex-wrap gap-2 lg:justify-end">
      {isOnline ? (
        <Button asChild variant="secondary" size="sm" className={ICON_CLASSES}>
          <Link href={editHref} aria-label={editLabel}>
            <Pencil aria-hidden strokeWidth={iconStroke} />
            {RECIPE_VIEW.edit}
          </Link>
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label={editLabel}
          aria-disabled
          className={cn(ICON_CLASSES, DISABLED_CLASSES)}
        >
          <Pencil aria-hidden strokeWidth={iconStroke} />
          {RECIPE_VIEW.edit}
        </Button>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-disabled={!isOnline || undefined}
        className={cn(ICON_CLASSES, !isOnline && DISABLED_CLASSES)}
        onClick={isOnline ? onRefresh : undefined}
      >
        <RefreshCw aria-hidden strokeWidth={iconStroke} />
        {RECIPE_ACTIONS.refresh}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-disabled={!isOnline || undefined}
        className={cn(ICON_CLASSES, !isOnline && DISABLED_CLASSES)}
        onClick={isOnline ? onAddToList : undefined}
      >
        <ShoppingCart aria-hidden strokeWidth={iconStroke} />
        {SHOPPING_LIST.addToList}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label={describeDuplicateRecipe(name)}
        aria-busy={isDuplicating || undefined}
        aria-disabled={isDuplicateDisabled || undefined}
        className={cn(ICON_CLASSES, isDuplicateDisabled && DISABLED_CLASSES)}
        onClick={isDuplicateDisabled || isDuplicating ? undefined : onDuplicate}
      >
        <Copy aria-hidden strokeWidth={iconStroke} />
        {RECIPE_ACTIONS.duplicate}
      </Button>
      {!isArchived && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={describeArchiveRecipe(name)}
          aria-busy={isArchiving || undefined}
          aria-disabled={!isOnline || undefined}
          className={cn(ICON_CLASSES, !isOnline && DISABLED_CLASSES)}
          onClick={!isOnline || isArchiving ? undefined : onArchive}
        >
          <Archive aria-hidden strokeWidth={iconStroke} />
          {RECIPE_ACTIONS.archive}
        </Button>
      )}
    </div>
  );
}
