import { RoutineProgressRow } from "../RoutineProgressRow";
import { GroupedList } from "../ui";

import type { RoutineProgressDayProps } from "./types";

/** One routine day of the Progress section: its name as the heading over a card with a row for each exercise. */
export function RoutineProgressDay({ day, onOpenExercise }: RoutineProgressDayProps) {
  return (
    <GroupedList title={day.name}>
      {day.exercises.map(({ exerciseId, ...exercise }) => (
        <RoutineProgressRow
          key={exerciseId}
          {...exercise}
          onPress={
            onOpenExercise === undefined
              ? undefined
              : () => {
                  onOpenExercise(exerciseId);
                }
          }
        />
      ))}
    </GroupedList>
  );
}
