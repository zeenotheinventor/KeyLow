import { bodyMapRendererFor } from "@keylow/core/training";
import { useState } from "react";

import { useBodyFigure } from "../../lib/bodyFigure";
import { useBodyMapRenderer } from "../../lib/bodyMapRenderer";
import { useBody3DSupport } from "../BodyView";
import { BottomSheet } from "../ui";
import { ExerciseMusclesBody } from "./ExerciseMusclesBody";

import type { ExerciseMusclesSheetProps } from "./types";

/**
 * The "Muscles it works" sheet of the workout screen, as the board `session · exercise-muscles` draws it:
 * the exercise's name, the front and the back of the body coloured by role, and a row for each role with
 * its muscles and what a set counts for. The contents draw their own heading, so the sheet is named
 * for the exercise and carries no title. The muscles are read only while the sheet is open, and the
 * exercise stays on show, as it was last drawn, through the sheet's exit.
 *
 * While the 3D body is the one drawn, as `BodyView` decides it, a drag that starts on the contents does not
 * move the sheet, so it turns the body. The sheet still closes from its handle, the dim, a screen reader's
 * escape and the Android back button. The decision is made when the sheet opens and kept until it opens
 * again. The library swaps the view that carries the contents when the drag setting changes, which would
 * remount them, so it must not change while the sheet is open. If 3D fails meanwhile, the stage stays with
 * the 2D figure in it, and the next opening is draggable again.
 */
export function ExerciseMusclesSheet({ exercise, onClose }: ExerciseMusclesSheetProps) {
  // The sheet takes its last length of time to leave, and the exercise must not vanish from it meanwhile.
  // Set while rendering on purpose, so the sheet opens on the exercise in the same render.
  const [lastExercise, setLastExercise] = useState(exercise);
  if (exercise !== null && exercise !== lastExercise) {
    setLastExercise(exercise);
  }
  const shown = exercise ?? lastExercise;
  const { figure, isReady: isFigureReady } = useBodyFigure();
  const { renderer: preference } = useBodyMapRenderer();
  const { canTry3d } = useBody3DSupport();
  const isBody3d = isFigureReady && bodyMapRendererFor({ preference, figure, canTry3d }) === "3d";
  // Taken in the render the sheet opens in and not changed until it opens again, also set while rendering.
  const isOpen = exercise !== null;
  const [wasOpen, setWasOpen] = useState(false);
  const [isBody3dOnOpen, setIsBody3dOnOpen] = useState(false);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setIsBody3dOnOpen(isBody3d);
    }
  }

  return (
    <BottomSheet
      isContentDraggable={!isBody3dOnOpen}
      label={shown?.name}
      open={isOpen}
      onClose={onClose}
    >
      {shown === null ? null : (
        <ExerciseMusclesBody key={shown.id} exercise={shown} isOpen={isOpen} />
      )}
    </BottomSheet>
  );
}
