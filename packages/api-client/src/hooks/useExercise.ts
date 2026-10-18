import { skipToken, useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getExercise } from "../repos/exercises";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { ExerciseDetail } from "../repos/exercises";

export type ExerciseState =
  | { status: "loading" }
  | {
      status: "error";
      /** The action and the error code. For logs and bug reports only, the UI must never render it. */
      debugMessage: string;
    }
  | { status: "notFound" }
  | { status: "ready"; exercise: ExerciseDetail };

/**
 * One live exercise with its full muscle map, as a screen state. `notFound` means the exercise is not
 * visible to the user (it does not exist, is archived, or is another user's private one), and is a state
 * and not an error. `error` is only taken when there is no exercise to show yet, so a failed background
 * refetch never replaces an exercise the user is looking at. Key `keys.training.exercise(id)`. It is
 * never kept in the mobile cache: it is only read while logging or editing, which needs a connection.
 *
 * Nothing is asked while `id` is undefined or empty, and the state is `loading`. `enabled` false makes no
 * request at all, and the state is `loading` while nothing has been asked.
 */
export function useExercise(
  id: string | undefined,
  { enabled = true }: DiaryReadOptions = {},
): ExerciseState {
  const client = useSupabase();

  const exercise = useQuery({
    queryKey: keys.training.exercise(id ?? ""),
    queryFn: id ? () => getExercise(client, id) : skipToken,
    enabled,
  });

  if (exercise.data === undefined) {
    return exercise.isError
      ? { status: "error", debugMessage: exercise.error.message }
      : { status: "loading" };
  }
  if (exercise.data === null) {
    return { status: "notFound" };
  }
  return { status: "ready", exercise: exercise.data };
}
