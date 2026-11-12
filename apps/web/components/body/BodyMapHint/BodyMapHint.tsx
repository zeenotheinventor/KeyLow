import { BODY_MAP } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Hand } from "lucide-react";

import type { BodyMapHintProps } from "./types";

import { Button } from "@/components/ui/Button";

/**
 * The line the body map draws once, on its first open in a browser: a hand, "Press and hold a muscle for
 * details" and Got it. It is a strip like the Toast, laid over the figures by the body map card (a Toast
 * is anchored to the top of the page, so it cannot sit on a card), and it has no timer: it stays until
 * Got it is pressed or a muscle's sheet is opened. The words are one group with the status role, and Got it
 * stays outside the group so it can be reached. The phone's words say Long-press, and a mouse has no such thing.
 */
export function BodyMapHint({ onDismiss }: BodyMapHintProps) {
  return (
    <div className="flex min-h-touch-target items-center gap-3 rounded-medium border border-border bg-surface-sheet py-1 pr-1 pl-3 text-text-primary shadow-toast">
      <div role="status" className="flex min-w-0 flex-1 items-center gap-3">
        <Hand
          aria-hidden
          className="size-5 shrink-0 text-text-secondary"
          strokeWidth={iconStroke}
        />
        <span className="min-w-0 flex-1 text-[14px] leading-5">{BODY_MAP.coachMark.textWeb}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDismiss}
        className="text-accent light-theme:text-text-primary"
      >
        {BODY_MAP.coachMark.dismiss}
      </Button>
    </div>
  );
}
