import { useExerciseMuscles } from "@keylow/api-client";
import { EXERCISE_MUSCLES, describeExerciseMusclesFigureLabel } from "@keylow/core/copy";
import { exerciseRoleValues, musclesByRole } from "@keylow/core/training";

import { FormSection } from "./FormSection";
import { RoleRow } from "./RoleRow";

import type { ExerciseMusclesDialogProps } from "./types";
import type { BodyArtworkSide } from "@keylow/core/training";

import { BodyFigure } from "@/components/ui/BodyFigure";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useBodyFigure } from "@/lib/bodyFigure";
import { useIsOnline } from "@/lib/useIsOnline";

const SIDES: readonly BodyArtworkSide[] = ["front", "back"];
const FIGURE_WIDTH = 120;
const LOADING_ROWS = 2;

/**
 * The "Muscles it works" dialog of the session page and the routine editor, the sheet of the `session ·
 * exercise-muscles` board in a `Dialog` (the web has no bottom sheet): the exercise's name, its form video or
 * photos (as the phone's sheet places them, above the caption), the caption, the front and the back of the body
 * coloured by role as plain images, and a row for each role with its muscles and what a set counts for, or
 * the loading rows, or the line that says why there are no muscles. The owner mounts it when it is opened, so
 * the map is read only then, and only when the page does not already hold it. Offline with nothing to show
 * it says so, since the read waits for a connection that may not come. The figure is drawn as the figure
 * setting has it, once that is read, so it never draws the wrong body first.
 */
export function ExerciseMusclesDialog({
  exerciseId,
  exerciseName,
  muscles,
  onClose,
  returnFocusTo,
}: ExerciseMusclesDialogProps) {
  const { figure, isReady: isFigureReady } = useBodyFigure();
  const state = useExerciseMuscles({
    exerciseId,
    known: muscles,
    isOpen: true,
    isOnline: useIsOnline(),
    enabled: true,
  });
  const readMuscles = state.status === "ready" ? state.muscles : [];
  const figureValues = exerciseRoleValues(readMuscles);

  return (
    <Dialog open title={exerciseName} onClose={onClose} returnFocusTo={returnFocusTo}>
      <div className="flex flex-col gap-3">
        <FormSection exerciseId={exerciseId} exerciseName={exerciseName} />
        <p className="text-caption text-text-secondary">{EXERCISE_MUSCLES.caption}</p>
        {isFigureReady ? (
          <div className="flex justify-center gap-6">
            {SIDES.map((side) => (
              <BodyFigure
                key={side}
                body={figure}
                label={describeExerciseMusclesFigureLabel({ name: exerciseName, side })}
                scale="role"
                side={side}
                values={figureValues}
                w={FIGURE_WIDTH}
              />
            ))}
          </div>
        ) : null}
        {state.status === "ready" ? (
          <>
            <Card padding="none" role="list" aria-label={EXERCISE_MUSCLES.listLabel}>
              {musclesByRole(state.muscles).map((row, index) => (
                <RoleRow
                  key={row.role}
                  role={row.role}
                  muscles={row.muscles}
                  hasDivider={index > 0}
                />
              ))}
            </Card>
            <p className="text-caption text-text-muted">{EXERCISE_MUSCLES.explanation}</p>
          </>
        ) : null}
        {state.status === "loading" ? (
          <Skeleton variant="rows" count={LOADING_ROWS} label={EXERCISE_MUSCLES.loadingName} />
        ) : null}
        {state.status === "offline" ? (
          <p className="text-caption text-text-muted">{EXERCISE_MUSCLES.offline}</p>
        ) : null}
        {state.status === "failed" ? (
          <p className="text-caption text-text-muted">{EXERCISE_MUSCLES.failed}</p>
        ) : null}
      </div>
    </Dialog>
  );
}
