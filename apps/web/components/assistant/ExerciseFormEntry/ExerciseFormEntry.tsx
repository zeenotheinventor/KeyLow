import { exerciseFormMediaDisplayOf } from "@keylow/core/training";
import { memo } from "react";

import type { ExerciseFormEntryProps } from "./types";

import { FormMediaCard } from "@/components/ui/FormMediaCard";

/**
 * The form video or the start and end photos of an exercise, as a card in the thread (`web-assistant-card ·
 * exercise-form`): the kit's form media card under the reply. The event carries a video id or two image
 * paths and never a URL, so every address is made by core's `exerciseFormMediaDisplayOf`, and a tool result
 * can never make the app open or load an arbitrary address. The card holds its media, so it has no request,
 * no loading and no failure of its own. It is memoised, because the thread draws again for every streamed
 * token, and `entry` keeps its reference while the turn goes on.
 */
export const ExerciseFormEntry = memo(function ExerciseFormEntry({
  entry,
}: ExerciseFormEntryProps) {
  const display = exerciseFormMediaDisplayOf(entry.exercise.media);

  switch (display.kind) {
    case "video":
      return <FormMediaCard {...display} />;
    case "photos":
      return <FormMediaCard {...display} exerciseName={entry.exercise.exerciseName} />;
    // The schema refuses `none`, so this only keeps the switch complete.
    case "none":
      return null;
  }
});
