import { DAY_COMPLETE_TOGGLE } from "@keylow/core";
import { iconStroke } from "@keylow/tokens";
import { Check } from "lucide-react";
import { useState } from "react";

import type { DayCompleteToggleProps } from "./types";

import { cn } from "@/lib/utils";

// The colours follow the button's own aria-checked, so the switch cannot draw one state while
// announcing the other. Every class is written out whole so Tailwind can see it.
const frame =
  "group relative flex min-h-[56px] w-full items-center gap-3 overflow-hidden rounded-medium border border-border bg-surface px-4 py-2 text-left text-text-primary outline-none transition-colors duration-quick focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none aria-checked:border-accent aria-checked:bg-accent-muted";

const track =
  "relative h-[26px] w-[44px] shrink-0 rounded-pill bg-border-strong transition-colors duration-quick motion-reduce:transition-none group-aria-checked:bg-accent";

const knob =
  "absolute left-[3px] top-[3px] flex size-5 items-center justify-center rounded-pill bg-text-primary transition-[transform,background-color] duration-standard ease-spring motion-reduce:transition-none group-aria-checked:translate-x-[18px] group-aria-checked:bg-accent-foreground";

/**
 * Marks a diary day complete so the energy engine can use it. Completing is a moment: an accent
 * slash crosses the row and the label punches in. Unmarking is quiet. Both movements stop under
 * prefers-reduced-motion. The moment belongs to a press from the off state, so a day that turns
 * complete by itself, such as the diary stepping to a complete day, plays nothing. The diary keys
 * the toggle by day (`key={localDate}`). A press the parent has not answered stays armed until
 * `complete` changes or the toggle is keyed anew, so a parent may answer after the server replies.
 */
export function DayCompleteToggle({
  complete = false,
  onChange,
  className,
  ...buttonProps
}: DayCompleteToggleProps) {
  const [moments, setMoments] = useState(0);
  const [wasComplete, setWasComplete] = useState(complete);
  const [isAwaitingComplete, setIsAwaitingComplete] = useState(false);
  const [isMomentLive, setIsMomentLive] = useState(false);

  // A new moment when the day becomes complete after a press from the off state. Any change of
  // `complete` uses up the press and ends the moment before it, so a change nobody pressed for plays
  // nothing. The moment is live for one change, not for as long as a counter is above zero.
  if (wasComplete !== complete) {
    const isMoment = complete && isAwaitingComplete;
    setWasComplete(complete);
    setIsAwaitingComplete(false);
    setIsMomentLive(isMoment);
    if (isMoment) {
      setMoments((count) => count + 1);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={complete}
      className={cn(frame, className)}
      onClick={() => {
        setIsAwaitingComplete(!complete);
        onChange?.(!complete);
      }}
      {...buttonProps}
    >
      <span className="flex flex-1 flex-col">
        <span
          key={moments}
          className={cn(
            "text-body-strong",
            isMomentLive && "animate-punch motion-reduce:animate-none",
          )}
        >
          {complete ? DAY_COMPLETE_TOGGLE.complete : DAY_COMPLETE_TOGGLE.markComplete}
        </span>
        <span className="text-caption text-text-muted">
          {complete ? DAY_COMPLETE_TOGGLE.completeCaption : DAY_COMPLETE_TOGGLE.markCompleteCaption}
        </span>
      </span>
      <span aria-hidden className={track}>
        <span className={knob}>
          <Check
            className="invisible size-3 stroke-accent group-aria-checked:visible"
            strokeWidth={iconStroke}
          />
        </span>
      </span>
      {isMomentLive && (
        <span
          key={`slash-${moments}`}
          aria-hidden
          data-testid="day-complete-slash"
          className="pointer-events-none absolute -bottom-[20%] -top-[20%] left-0 w-[16%] animate-slash bg-accent opacity-0 motion-reduce:animate-none"
        />
      )}
    </button>
  );
}
