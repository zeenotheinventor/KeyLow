import { describeAddFood } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { ChefHat, ChevronRight, Plus, Utensils } from "lucide-react";

import { RecipeName } from "../RecipeName";
import { RecipeTile } from "../RecipeTile";
import { interactiveClasses } from "../rowStates";
import { StatsLine } from "../StatsLine";

import type { FoodLogRowProps } from "../types";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// The boards draw these rows with the type styles as they are, so the title keeps the body line of
// 24 px. The focus ring is drawn inside the row because the list clips its corners.
const rowButtonClasses =
  "flex w-full min-w-0 flex-1 items-center gap-3 text-left text-text-primary outline-none transition-[transform,background-color] duration-instant ease-spring focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring";

const layoutClasses = {
  stacked: "min-h-[56px] py-2 pl-4 pr-3",
  search: "min-h-[60px] py-2 pl-3",
} as const;

// With buttons at its end a stacked row gives them the room the board draws: 8 px, not 12.
const stackedWithActionsClasses = "min-h-[56px] py-2 pl-4 pr-2";

const textColumnClasses = {
  stacked: "flex min-w-0 flex-1 flex-col gap-[2px]",
  search: "flex min-w-0 flex-1 flex-col gap-1",
} as const;

/** A food in the food log: a logged food in the diary (`stacked`) or a result in the add dialog (`search`). */
export function FoodLogRow({
  layout,
  nameSegments,
  brand,
  caption,
  energy,
  macros,
  recipeRowName,
  needsReview = false,
  disabled = false,
  className,
  onClick,
  onAdd,
  addDisabled = false,
  actions,
}: FoodLogRowProps) {
  const name = nameSegments.map((segment) => segment.text).join("");
  const isSearch = layout === "search";
  const isRecipe = recipeRowName !== undefined;
  const showsAdd = isSearch && onAdd !== undefined && !needsReview;
  const isAddInert = addDisabled || disabled;
  const rowClasses =
    layout === "stacked" && actions !== undefined
      ? stackedWithActionsClasses
      : layoutClasses[layout];

  const title = isSearch
    ? nameSegments.map((segment, index) => (
        <span
          // The segments are cut from one name, so their order never changes.
          key={index}
          className={segment.matched ? "font-semibold" : "font-normal"}
        >
          {segment.text}
        </span>
      ))
    : name;

  // A row with nothing to open is plain text: no button and no chevron, so it does not promise a press.
  const isPressable = onClick !== undefined;

  const content = (
    <>
      {isSearch &&
        (isRecipe ? (
          <RecipeTile />
        ) : (
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-small bg-surface-raised text-text-secondary"
          >
            <Utensils className="size-5" strokeWidth={iconStroke} />
          </span>
        ))}
      <span className={textColumnClasses[layout]}>
        {isRecipe && isSearch ? (
          // A recipe in the search is drawn as the library draws it: the chef's hat is the tile, and the name
          // keeps its matched letters semibold.
          <span className="line-clamp-2 text-body">
            <RecipeName nameSegments={nameSegments} />
          </span>
        ) : isRecipe ? (
          // The board draws a logged recipe's name on one line, after a 16 px chef's hat.
          <span className="flex min-w-0 items-center gap-[6px] text-body-strong">
            <ChefHat
              aria-hidden
              className="size-4 shrink-0 text-text-muted"
              strokeWidth={iconStroke}
            />
            <span className="truncate">{name}</span>
          </span>
        ) : (
          <span className={cn("line-clamp-2", isSearch ? "text-body" : "text-body-strong")}>
            {title}
            {brand !== undefined && <span className="text-text-muted"> · {brand}</span>}
          </span>
        )}
        {caption !== undefined && (
          <span className="truncate text-caption tabular-nums text-text-muted">{caption}</span>
        )}
        <StatsLine energy={energy} macros={macros} needsReview={needsReview} />
      </span>
      {!showsAdd && isPressable && (
        // Where the add button would be, the chevron sits in a box of the same 44 px so the rows line up.
        <span
          aria-hidden
          className={cn(
            "flex shrink-0 items-center justify-center text-text-muted",
            isSearch ? "mr-1 h-control-md w-control-md" : "size-4",
          )}
        >
          <ChevronRight className="size-4" strokeWidth={iconStroke} />
        </span>
      )}
    </>
  );

  const row = isPressable ? (
    <button
      type="button"
      className={cn(
        rowButtonClasses,
        rowClasses,
        !disabled && interactiveClasses,
        disabled && "pointer-events-none",
      )}
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
    >
      {content}
    </button>
  ) : (
    <div className={cn("flex w-full min-w-0 flex-1 items-center gap-3", rowClasses)}>{content}</div>
  );

  return (
    <li
      aria-label={recipeRowName}
      className={cn("flex items-center", disabled && "opacity-50", className)}
    >
      {row}
      {actions !== undefined && <div className="flex shrink-0 flex-col pr-2">{actions}</div>}
      {showsAdd && (
        <Button
          type="button"
          variant="ring"
          iconOnly
          className={cn(
            "mr-1",
            // A disabled row is already dimmed as a whole.
            addDisabled && !disabled && "opacity-50",
            isAddInert && "pointer-events-none",
          )}
          aria-label={describeAddFood(name, caption)}
          aria-disabled={isAddInert || undefined}
          onClick={isAddInert ? undefined : onAdd}
        >
          <Plus aria-hidden strokeWidth={2} />
        </Button>
      )}
    </li>
  );
}
