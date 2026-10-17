import { describeEditStep, describeMoveStep, describeRemoveStep } from "@keylow/core/copy";
import { ChevronDown, ChevronUp, Pencil, X } from "lucide-react";

import { StepTextEditor } from "./StepTextEditor";

import type { StepRowProps } from "./types";

import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/utils";

/**
 * One step of a recipe's method: the number in a circle and the full text beside it. The recipe view's row
 * is read only. The editor's row ends in Move up, Move down, Edit and Remove, always drawn, each named for
 * its place: beside the text from the medium width, and on a line under it below. While a step is edited
 * the text and the buttons give way to a field with Done and Cancel. A step that has just moved is tinted.
 */
export function StepRow({ number, text, controls, editor, isHighlighted = false }: StepRowProps) {
  return (
    <li
      className={cn(
        "flex gap-2 border-t border-border px-4 py-3 transition-colors duration-quick max-md:flex-col",
        isHighlighted && "bg-accent-muted",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-pill border border-border bg-surface-raised text-caption font-semibold tabular-nums"
        >
          {number}
        </span>
        {editor === undefined ? (
          <span className="min-w-0 flex-1 break-words text-body">{text}</span>
        ) : (
          <StepTextEditor number={number} editor={editor} />
        )}
      </div>
      {controls !== undefined && editor === undefined && (
        // Under the text, the buttons start where the text does: the circle, the gap, and the icon's inset in its button.
        <div className="flex shrink-0 gap-0.5 max-md:pl-7">
          <IconButton
            icon={ChevronUp}
            label={describeMoveStep(number, "up")}
            disabled={controls.isLocked || !controls.canMoveUp}
            onClick={controls.onMoveUp}
          />
          <IconButton
            icon={ChevronDown}
            label={describeMoveStep(number, "down")}
            disabled={controls.isLocked || !controls.canMoveDown}
            onClick={controls.onMoveDown}
          />
          <IconButton
            icon={Pencil}
            label={describeEditStep(number)}
            disabled={controls.isLocked}
            onClick={controls.onEdit}
          />
          <IconButton
            icon={X}
            label={describeRemoveStep(number)}
            disabled={controls.isLocked}
            onClick={(event) => {
              controls.onRemove(event.currentTarget);
            }}
          />
        </div>
      )}
    </li>
  );
}
