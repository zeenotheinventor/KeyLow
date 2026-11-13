import { iconStroke } from "@keylow/tokens";
import { ChevronRight } from "lucide-react";

import type { AssistantLinkRowProps } from "./types";

import { cn } from "@/lib/utils";

/**
 * The line that opens what an assistant answer is about, such as the routine editor: the label in the accent
 * ink with a chevron, at the touch target's height. It is the last line of an action card, and it can stand on
 * its own under an answer that made no card.
 */
export function AssistantLinkRow({ label, onPress, isStandalone = false }: AssistantLinkRowProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        "flex min-h-touch-target w-full items-center gap-2 px-3 text-left text-body-strong text-accent-ink outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring",
        isStandalone ? "rounded-large border border-border bg-surface" : "border-t border-border",
      )}
    >
      <span className="flex-1">{label}</span>
      <ChevronRight aria-hidden className="size-4 shrink-0" strokeWidth={iconStroke} />
    </button>
  );
}
