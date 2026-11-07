import { describeExerciseMusclesFigureLabel, EXERCISE_MUSCLES } from "@keylow/core/copy";
import { exerciseRoleValues, musclesByRole } from "@keylow/core/training";
import { memo } from "react";
import { View } from "react-native";

import { useBodyFigure } from "../../../lib/bodyFigure";
import { RoleRow } from "../../ExerciseMusclesSheet/RoleRow";
import { BodyFigure, Text } from "../../ui";

import type { ExerciseMusclesEntryProps } from "./types";

const FIGURE_WIDTH = 96;
const SIDES = ["front", "back"] as const;

/**
 * The muscles an exercise works, as a card in the thread (`assistant-card · exercise-muscles`): the
 * exercise's name and caption, the front and the back of the body coloured by role, and a row for each
 * role. It is a read, so it has no icon, no Undo and no link, and it is flat as the action card is. The body
 * is always 2D, whatever the person chose in More, and waits for the stored figure setting so the wrong body
 * never shows first. The card holds its muscles, so there is no request, no loading and no failure. It is
 * memoised, because the thread draws again for every streamed token and each card holds two SVG figures. Its
 * one prop is a stable reference: the live turn keeps the object it was sent, and a stored conversation read
 * again keeps the objects that did not change.
 */
export const ExerciseMusclesEntry = memo(function ExerciseMusclesEntry({
  exercise,
}: ExerciseMusclesEntryProps) {
  const { figure, isReady: isFigureReady } = useBodyFigure();
  const figureValues = exerciseRoleValues(exercise.muscles);

  return (
    <View className="overflow-hidden rounded-large border border-border bg-surface">
      <View className="gap-[2px] p-3">
        <Text role="heading" variant="body-strong">
          {exercise.exerciseName}
        </Text>
        <Text tone="secondary" variant="caption">
          {EXERCISE_MUSCLES.caption}
        </Text>
      </View>
      {isFigureReady ? (
        <View className="flex-row justify-center gap-6 px-3 pb-3">
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
        </View>
      ) : null}
      <View aria-label={EXERCISE_MUSCLES.listLabel} role="list">
        {musclesByRole(exercise.muscles).map((row) => (
          <RoleRow key={row.role} hasDivider muscles={row.muscles} role={row.role} />
        ))}
      </View>
    </View>
  );
});
