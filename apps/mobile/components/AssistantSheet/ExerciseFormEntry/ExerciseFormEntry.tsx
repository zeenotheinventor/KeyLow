import { exerciseFormMediaDisplayOf } from "@keylow/core/training";
import { memo } from "react";

import { FormMediaCard } from "../../ui";

import type { ExerciseFormEntryProps } from "./types";

/**
 * The form video or the start and end photos of an exercise, as a card in the thread (`assistant-card ·
 * exercise-form`): the shared form media card, under the reply. The event carries a video id or two image
 * paths and never a URL, so every address is made here by `exerciseFormMediaDisplayOf`, and a tool result
 * can never make the app open or load an arbitrary address. The card holds its media, so there is no request,
 * no loading and no failure of its own. It is memoised, because the thread draws again for every streamed
 * token. Its one prop is a stable reference: the live turn keeps the object it was sent.
 */
export const ExerciseFormEntry = memo(function ExerciseFormEntry({
  exercise,
}: ExerciseFormEntryProps) {
  const display = exerciseFormMediaDisplayOf(exercise.media);

  switch (display.kind) {
    case "video":
      return <FormMediaCard {...display} />;
    case "photos":
      return <FormMediaCard {...display} exerciseName={exercise.exerciseName} />;
    // The schema refuses `none`, so this only keeps the switch complete.
    case "none":
      return null;
  }
});
