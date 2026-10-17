import Link from "next/link";

import { RecipeName } from "../RecipeName";
import { RecipeTile } from "../RecipeTile";
import { interactiveClasses } from "../rowStates";
import { StatsLine } from "../StatsLine";

import type { RecipeRowProps } from "../types";

import { cn } from "@/lib/utils";

// The boards draw the row 60 high with 12 px before the tile and 4 after the text, where the row's
// action buttons will sit. The focus ring is drawn inside the row because the list clips its corners.
const linkClasses =
  "flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2 pl-3 pr-1 text-left text-text-primary no-underline outline-none transition-[transform,background-color] duration-instant ease-spring focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring";

/** A recipe in the library at the narrow width. The whole row is the link that opens the recipe. */
export function RecipeRow({
  nameSegments,
  href,
  openLabel,
  caption,
  energy,
  macros,
  className,
}: RecipeRowProps) {
  return (
    <li className={cn("flex items-center", className)}>
      <Link href={href} aria-label={openLabel} className={cn(linkClasses, interactiveClasses)}>
        <RecipeTile />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-2 text-body">
            <RecipeName nameSegments={nameSegments} />
          </span>
          <span className="truncate text-caption tabular-nums text-text-muted">{caption}</span>
          <StatsLine energy={energy} macros={macros} />
        </span>
      </Link>
    </li>
  );
}
