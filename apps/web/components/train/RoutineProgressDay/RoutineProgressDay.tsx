import { RoutineProgressRow } from "../RoutineProgressRow";

import type { RoutineProgressDayProps } from "./types";

import { GroupedList } from "@/components/ui/GroupedList";
import { trainExerciseProgressPath } from "@/lib/trainRoutes";

/** One routine day of the Progress section: its name as the heading over a card with a row for each exercise, each linking to the exercise's progress page. */
export function RoutineProgressDay({ day }: RoutineProgressDayProps) {
  return (
    <GroupedList title={day.name}>
      {day.exercises.map(({ exerciseId, ...exercise }) => (
        <RoutineProgressRow
          key={exerciseId}
          {...exercise}
          href={trainExerciseProgressPath(exerciseId)}
        />
      ))}
    </GroupedList>
  );
}
