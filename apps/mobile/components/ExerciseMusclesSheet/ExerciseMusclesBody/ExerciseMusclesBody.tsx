import { BODY_MAP, describeExerciseMusclesFigureLabel, EXERCISE_MUSCLES } from "@keylow/core/copy";
import { exerciseRoleValues, musclesByRole } from "@keylow/core/training";
import { useState } from "react";
import { View } from "react-native";

import { useBodyFigure } from "../../../lib/bodyFigure";
import { BodyStage } from "../../BodyMapFigures";
import { useBody3DLayout } from "../../BodyView";
// Not through the screen's barrel: the screen mounts this sheet, and the barrel would import it back.
import { useExerciseMuscles } from "../../SessionScreen/useExerciseMuscles";
import { BodyFigure, Card, SegmentedControl, Skeleton, Text } from "../../ui";
import { RoleRow } from "../RoleRow";

import type { ExerciseMusclesBodyProps } from "./types";
import type { ExerciseMusclesState } from "../../SessionScreen/useExerciseMuscles";
import type { BodyArtworkSide } from "@keylow/core/training";

const FIGURE_WIDTH = 120;
const SIDES = ["front", "back"] as const;
const LOADING_ROWS = 2;
const SIDE_OPTIONS = [
  { value: "front", label: BODY_MAP.sideSwitch.front },
  { value: "back", label: BODY_MAP.sideSwitch.back },
] as const;

function isSameState(first: ExerciseMusclesState, second: ExerciseMusclesState): boolean {
  if (first.status === "ready" && second.status === "ready") {
    return first.muscles === second.muscles;
  }
  return first.status === second.status;
}

/**
 * The contents of the Muscles it works sheet for one exercise: its name and caption, the body coloured by
 * role, and below it the role rows and the explanation, or the loading rows, or the line that says why
 * there are no muscles. The body is the front and the back in 2D, or when the person chose 3D in More and
 * the phone can draw it, one body on the dark stage with the Front and Back switch and the line that says to
 * drag. It is drawn as the figure setting has it, and waits for the stored setting, which the phone gives
 * at once, so it never draws the wrong body first. The side the 3D body faces starts at the front for each
 * exercise. While the sheet is closed the hook has no map for an exercise it does not know and says
 * loading, so the state it had while the sheet was open is the one that stays on show through the exit.
 */
export function ExerciseMusclesBody({ exercise, isOpen }: ExerciseMusclesBodyProps) {
  const { figure, isReady: isFigureReady } = useBodyFigure();
  const live = useExerciseMuscles({
    exerciseId: exercise.id,
    known: exercise.muscles,
    isOpen,
  });
  // Set while rendering on purpose, so the state is kept in the render it arrives in.
  const [lastOpenState, setLastOpenState] = useState(live);
  if (isOpen && !isSameState(live, lastOpenState)) {
    setLastOpenState(live);
  }
  const state = isOpen ? live : lastOpenState;
  const muscles = state.status === "ready" ? state.muscles : [];
  const isIn3d = useBody3DLayout(figure);
  // The side the 3D body faces, which the switch under it and a drag of the body both set.
  const [side3d, setSide3d] = useState<BodyArtworkSide>("front");
  const figureValues = exerciseRoleValues(muscles);

  return (
    <View className="gap-3">
      <View className="gap-[2px]">
        <Text role="heading" variant="h2">
          {exercise.name}
        </Text>
        <Text tone="secondary" variant="caption">
          {EXERCISE_MUSCLES.caption}
        </Text>
      </View>
      {isFigureReady && isIn3d ? (
        <View className="gap-2">
          <BodyStage
            body={figure}
            label={describeExerciseMusclesFigureLabel({ name: exercise.name, side: side3d })}
            scale="role"
            side={side3d}
            values={figureValues}
            onSideChange={setSide3d}
          />
          <View className="flex-row items-center justify-between gap-2">
            <View className="w-[150px]">
              <SegmentedControl
                hint={BODY_MAP.sideSwitchDescription}
                label={BODY_MAP.sideSwitch.name}
                onChange={setSide3d}
                options={SIDE_OPTIONS}
                size="sm"
                value={side3d}
              />
            </View>
            <Text className="min-w-0 shrink" tone="muted" variant="caption">
              {EXERCISE_MUSCLES.rotateHint}
            </Text>
          </View>
        </View>
      ) : null}
      {isFigureReady && !isIn3d ? (
        <View className="flex-row justify-center gap-6">
          {SIDES.map((side) => (
            <BodyFigure
              key={side}
              body={figure}
              label={describeExerciseMusclesFigureLabel({ name: exercise.name, side })}
              scale="role"
              side={side}
              values={figureValues}
              w={FIGURE_WIDTH}
            />
          ))}
        </View>
      ) : null}
      {state.status === "ready" ? (
        <>
          <Card aria-label={EXERCISE_MUSCLES.listLabel} padding={0} role="list">
            {musclesByRole(state.muscles).map((row, index) => (
              <RoleRow
                key={row.role}
                hasDivider={index > 0}
                muscles={row.muscles}
                role={row.role}
              />
            ))}
          </Card>
          <Text tone="muted" variant="caption">
            {EXERCISE_MUSCLES.explanation}
          </Text>
        </>
      ) : null}
      {state.status === "loading" ? (
        <View accessible aria-label={EXERCISE_MUSCLES.loadingName} role="status">
          <Skeleton rows={LOADING_ROWS} variant="group" />
        </View>
      ) : null}
      {state.status === "offline" ? (
        <Text tone="muted" variant="caption">
          {EXERCISE_MUSCLES.offline}
        </Text>
      ) : null}
      {state.status === "failed" ? (
        <Text tone="muted" variant="caption">
          {EXERCISE_MUSCLES.failed}
        </Text>
      ) : null}
    </View>
  );
}
