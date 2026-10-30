import { iconStroke } from "@keylow/tokens";
import { Check } from "lucide-react";

import type { SetCheckButtonProps } from "./types";

import { cn } from "@/lib/utils";

// A 36 px square with the small radius, as the board draws the check. Below the md breakpoint an invisible
// pseudo element reaches 4 px past each edge to a 44 px target, as the kit's icon button does.
const baseClasses =
  "relative inline-flex h-control-sm w-control-sm items-center justify-center rounded-small border p-0 outline-none transition-transform duration-instant ease-spring focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset active:scale-press disabled:pointer-events-none disabled:opacity-40 motion-reduce:active:scale-100 max-md:after:absolute max-md:after:-inset-1";

const toneClasses = {
  logged: "border-success bg-success text-text-on-status",
  toLog: "border-border bg-surface-raised text-text-muted hover:text-text-primary",
} as const;

/** The check at the end of a set's row: empty and quiet for a set to log, filled for one that is logged. */
export function SetCheckButton({ name, isLogged, onPress }: SetCheckButtonProps) {
  return (
    <button
      type="button"
      aria-label={name}
      disabled={onPress === undefined}
      className={cn(baseClasses, isLogged ? toneClasses.logged : toneClasses.toLog)}
      onClick={onPress}
    >
      <Check aria-hidden strokeWidth={iconStroke} className="size-4" />
    </button>
  );
}
