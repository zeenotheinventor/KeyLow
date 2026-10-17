import { RECIPE_ACTIONS, describeArchiveRecipe, describeDuplicateRecipe } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Archive, Copy } from "lucide-react";

import type { RecipeRowActionsProps } from "./types";

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";

// The boards draw these ghost buttons with 8 px beside the icon and the icon at 18 px, where the small
// size has 12 and 16.
const BUTTON_CLASSES = "px-2 [&_svg]:size-[18px]";

/**
 * The Duplicate and Archive buttons of a library row, always visible. In the table each is a small ghost
 * button with its icon and word, and in the narrow list an icon button, one over the other. Duplicate is
 * busy while its copy is saved, and does not respond then, so a second press makes no second copy.
 */
export function RecipeRowActions({
  name,
  layout,
  isDuplicating,
  onDuplicate,
  onArchive,
  archiveButtonRef,
}: RecipeRowActionsProps) {
  const duplicateState = {
    "aria-busy": isDuplicating || undefined,
    "aria-disabled": isDuplicating || undefined,
    onClick: isDuplicating ? undefined : onDuplicate,
  };

  if (layout === "card") {
    return (
      <span className="mr-1 flex shrink-0 flex-col">
        <IconButton icon={Copy} label={describeDuplicateRecipe(name)} {...duplicateState} />
        <IconButton
          ref={archiveButtonRef}
          icon={Archive}
          label={describeArchiveRecipe(name)}
          onClick={onArchive}
        />
      </span>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={BUTTON_CLASSES}
        aria-label={describeDuplicateRecipe(name)}
        {...duplicateState}
      >
        <Copy aria-hidden strokeWidth={iconStroke} />
        {RECIPE_ACTIONS.duplicate}
      </Button>
      <Button
        ref={archiveButtonRef}
        variant="ghost"
        size="sm"
        className={BUTTON_CLASSES}
        aria-label={describeArchiveRecipe(name)}
        onClick={onArchive}
      >
        <Archive aria-hidden strokeWidth={iconStroke} />
        {RECIPE_ACTIONS.archive}
      </Button>
    </>
  );
}
