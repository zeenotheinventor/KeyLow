import { iconStroke } from "@keylow/tokens";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useId } from "react";

import type { RoutineDayRowProps } from "./types";

/**
 * One day of a routine inside an `AssistantActionCard`: the day's name, its summary as a caption and a
 * chevron that turns over when the day is open. Pressing it shows or hides the day's exercises in place,
 * each as a name over its detail. Every word is the caller's and is drawn exactly as given. The row is the
 * card's own and is not part of the kit's public surface.
 */
export function RoutineDayRow({ day, isOpen, onPress }: RoutineDayRowProps) {
  const exercisesId = useId();
  // The chevron turning over is the up glyph, as the routine editor's day card draws it.
  const Chevron = isOpen ? ChevronUp : ChevronDown;

  return (
    <div className="border-t border-border">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? exercisesId : undefined}
        aria-label={`${day.name}, ${day.summary}`}
        onClick={onPress}
        // The row sits inside a card that clips its corners, so the keyboard focus ring is drawn inside it.
        className="flex min-h-[52px] w-full items-center gap-3 px-3 py-[6px] text-left outline-none transition-colors hover:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring active:bg-press-overlay"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-strong text-text-primary">{day.name}</span>
          <span className="text-caption text-text-secondary">{day.summary}</span>
        </span>
        <Chevron
          aria-hidden
          className="size-4 shrink-0 stroke-text-muted"
          strokeWidth={iconStroke}
        />
      </button>
      {isOpen ? (
        <div id={exercisesId} className="flex flex-col gap-2 px-3 pb-3">
          {day.exercises.map((exercise, index) => (
            <div key={`${index}-${exercise.name}`}>
              <div className="text-body text-text-primary">{exercise.name}</div>
              <div className="text-caption text-text-muted">{exercise.detail}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
