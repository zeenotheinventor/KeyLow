import { skipToken, useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getExerciseFormMedia } from "../repos/exerciseFormMedia";

import type { ExerciseFormMediaSet } from "@keylow/core/training";

// The media changes only through a migration, so a day is as fresh as it needs to be.
const STALE_TIME_MS = 24 * 60 * 60 * 1000;

/**
 * What a surface has of an exercise's form media: what the exercise has (a video, photos, both or
 * neither), still being read, not readable because the device is offline and holds no copy, or not
 * readable because the read failed.
 */
export type ExerciseFormMediaState =
  | { status: "ready"; media: ExerciseFormMediaSet }
  | { status: "loading" }
  | { status: "offline" }
  | { status: "failed" };

/**
 * The form media of an exercise for a sheet, the routine editor or a chat card. The server is asked only
 * while `isOpen`, since the read is not kept on the device and needs a connection. The caller says
 * whether reads are `enabled` and whether the device `isOnline`, since each app knows that its own way.
 * Key `keys.training.exerciseFormMedia(id)`.
 */
export function useExerciseFormMedia({
  exerciseId,
  isOpen,
  isOnline,
  enabled,
}: {
  exerciseId: string;
  isOpen: boolean;
  isOnline: boolean;
  enabled: boolean;
}): ExerciseFormMediaState {
  const client = useSupabase();

  const formMedia = useQuery({
    queryKey: keys.training.exerciseFormMedia(exerciseId),
    queryFn: isOpen ? () => getExerciseFormMedia(client, exerciseId) : skipToken,
    enabled,
    staleTime: STALE_TIME_MS,
  });

  if (formMedia.data !== undefined) {
    return { status: "ready", media: formMedia.data };
  }
  if (formMedia.isError) {
    return { status: "failed" };
  }
  return isOpen && !isOnline ? { status: "offline" } : { status: "loading" };
}
