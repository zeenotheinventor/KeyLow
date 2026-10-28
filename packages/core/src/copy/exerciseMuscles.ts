import { MUSCLE_NAMES } from "./muscleNames";
import { CUSTOM_EXERCISE, CUSTOM_EXERCISE_ROLES } from "./sessionExercise";

import type { BodyArtworkSide } from "../training/bodyArtwork";
import type { MuscleRole } from "../training/enums";
import type { ROLE_FIGURE_VALUES } from "../training/exerciseRoles";
import type { MuscleId } from "../training/muscles";

/*
 * The words of the "Muscles it works" sheet of the workout screen (KEY-741), as the boards `session ·
 * active`, `session · exercise-muscles` and `session · exercise-muscles-3d` draw them. The caption, the
 * explanation and the role lines are the New exercise form's own, so each is written once. The offline and
 * failed lines are proposed in KEY-739, and follow the body map's.
 */

/** The fixed words of the sheet. */
export const EXERCISE_MUSCLES = {
  caption: CUSTOM_EXERCISE.musclesHeading,
  explanation: CUSTOM_EXERCISE.roleExplanation,
  /** Under the 3D body. The body map's own hint also names the long press, which the sheet does not offer. */
  rotateHint: "Drag to turn · Pinch to zoom",
  offline: "The muscles aren't available offline.",
  failed: "The muscles could not be loaded. Check your connection and try again.",
  /** The accessible names of the loading rows and of the list of roles, which the board draws without words. */
  loadingName: "Loading the muscles",
  listLabel: "Muscles by role",
} as const;

/** A value of the `role` scale: 0 for a muscle at rest, then the values `ROLE_FIGURE_VALUES` writes. */
export type RoleValue = 0 | (typeof ROLE_FIGURE_VALUES)[MuscleRole];

/** What a screen reader says for a muscle on the `role` scale, keyed by the value. */
export const ROLE_VALUE_NAMES: Readonly<Record<RoleValue, string>> = {
  0: "Not worked",
  1: "Assisting",
  2: "Secondary",
  3: "Primary",
};

/** The name of the header button that opens the sheet. */
export const describeExerciseMusclesButton = (exerciseName: string): string =>
  `Muscles for ${exerciseName}`;

/** A row of the sheet: the muscle names, then the role and what it counts for. */
export const describeRoleRow = (
  role: MuscleRole,
  muscles: readonly MuscleId[],
): Readonly<{ muscles: string; role: string }> => ({
  muscles: muscles.map((muscle) => MUSCLE_NAMES[muscle]).join(", "),
  role: CUSTOM_EXERCISE_ROLES[role].help,
});

/** The accessible name of the figure: "Leg Press, muscles it works, front". */
export const describeExerciseMusclesFigureLabel = ({
  name,
  side,
}: Readonly<{ name: string; side: BodyArtworkSide }>): string =>
  `${name}, ${EXERCISE_MUSCLES.caption.toLowerCase()}, ${side}`;
