"use client";

import { EXERCISE_MUSCLES, describeExerciseMusclesFigureLabel } from "@keylow/core/copy";
import { exerciseRoleValues, musclesByRole } from "@keylow/core/training";
import { memo } from "react";

import type { ExerciseMusclesEntryProps } from "./types";
import type { BodyArtworkSide } from "@keylow/core/training";

import { RoleRow } from "@/components/train/ExerciseMusclesDialog/RoleRow";
import { BodyFigure } from "@/components/ui/BodyFigure";
import { Card } from "@/components/ui/Card";
import { useBodyFigure } from "@/lib/bodyFigure";

const SIDES: readonly BodyArtworkSide[] = ["front", "back"];
const FIGURE_WIDTH = 96;

/**
 * The muscles an exercise works, as a card in the thread (`web-assistant · exercise-muscles`): the exercise's
 * name and caption, the front and the back of the body coloured by role as plain images, and a row for each
 * role. It is a read, so it has no Undo and no link. The body is always 2D, whatever the person chose in
 * More, and waits for the stored figure setting so the wrong body never shows first. The card holds its
 * muscles, so there is no request and no failure. It is memoised because the thread draws again for every
 * streamed token and each card holds two SVG figures.
 */
export const ExerciseMusclesEntry = memo(function ExerciseMusclesEntry({
  entry,
}: ExerciseMusclesEntryProps) {
  const { exercise } = entry;
  const { figure, isReady: isFigureReady } = useBodyFigure();
  const figureValues = exerciseRoleValues(exercise.muscles);

  return (
    <Card padding="none" className="shadow-none">
      <div className="flex flex-col gap-0.5 px-3 pt-3">
        <h3 className="text-body-strong">{exercise.exerciseName}</h3>
        <p className="text-caption text-text-secondary">{EXERCISE_MUSCLES.caption}</p>
      </div>
      {isFigureReady ? (
        <div className="flex justify-center gap-6 px-3 py-4">
          {SIDES.map((side) => (
            <BodyFigure
              key={side}
              body={figure}
              label={describeExerciseMusclesFigureLabel({ name: exercise.exerciseName, side })}
              scale="role"
              side={side}
              values={figureValues}
              w={FIGURE_WIDTH}
            />
          ))}
        </div>
      ) : null}
      <div role="list" aria-label={EXERCISE_MUSCLES.listLabel} className="border-t border-border">
        {musclesByRole(exercise.muscles).map((row, index) => (
          <RoleRow key={row.role} hasDivider={index > 0} muscles={row.muscles} role={row.role} />
        ))}
      </div>
    </Card>
  );
});
