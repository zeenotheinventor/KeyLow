import { TRAIN_NO_ROUTINE } from "@keylow/core/copy";
import { Calendar } from "lucide-react";

import { TrainIconTile } from "../TrainIconTile";

import type { TrainNoRoutineProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * The card for a person who has trained but has no active routine, as the `train · no-routine` board draws
 * it: a calendar tile beside the title, a sentence, and the two ways forward side by side. A button is drawn
 * only when its handler is given, so none is a dead control.
 */
export function TrainNoRoutine({
  onCreateRoutine,
  onLogSession,
  isLogDisabled,
  isStarting = false,
}: TrainNoRoutineProps) {
  return (
    <Card asChild padding="none" className="p-5">
      <section aria-label={TRAIN_NO_ROUTINE.sectionName} className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <TrainIconTile icon={Calendar} />
          <h2 className="min-w-0 flex-1 text-h2">{TRAIN_NO_ROUTINE.title}</h2>
        </div>
        <p className="text-body text-text-secondary">{TRAIN_NO_ROUTINE.body}</p>
        {onCreateRoutine === undefined && onLogSession === undefined ? null : (
          <div className="mt-2 flex gap-2">
            {onCreateRoutine === undefined ? null : (
              <Button className="flex-1 md:flex-none" onClick={onCreateRoutine}>
                {TRAIN_NO_ROUTINE.createAction}
              </Button>
            )}
            {onLogSession === undefined ? null : (
              <Button
                // The board's second label wraps at a phone width, so the button grows in height.
                className="h-auto min-h-control-md flex-1 whitespace-normal py-1 md:flex-none"
                variant="secondary"
                disabled={isLogDisabled}
                loading={isStarting}
                onClick={onLogSession}
              >
                {TRAIN_NO_ROUTINE.logAction}
              </Button>
            )}
          </div>
        )}
      </section>
    </Card>
  );
}
