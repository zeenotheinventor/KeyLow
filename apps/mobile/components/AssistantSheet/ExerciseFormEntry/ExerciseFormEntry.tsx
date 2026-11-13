import { exerciseFormMediaDisplayOf, formMediaToShow } from "@keylow/core/training";
import { memo } from "react";

import { useFormMediaPreference } from "../../../lib/formMediaPreference";
import { FormMediaCard } from "../../ui";

import type { ExerciseFormEntryProps } from "./types";
import type { ExerciseFormMediaSet } from "@keylow/core/training";

/**
 * The form video or the start and end photos of an exercise, or both, as a card in the thread
 * (`assistant-card · exercise-form` and `assistant-card-both`): the shared form media card, under the reply,
 * with no switch. What it draws is the Exercise demos preference at the moment it is drawn, from the media
 * the event carries, so a stored thread follows a change and a card that carries only a video draws the
 * video under every preference. The event carries a video id or two image paths and never a URL, so
 * every address is made here by `exerciseFormMediaDisplayOf`, and a tool result can never make the app
 * open or load an arbitrary address. The card holds its media, so there is no request,
 * no loading and no failure of its own. It is memoised, because the thread draws again for every streamed
 * token. Its one prop is a stable reference: the live turn keeps the object it was sent.
 */
export const ExerciseFormEntry = memo(function ExerciseFormEntry({
  exercise,
}: ExerciseFormEntryProps) {
  const { preference } = useFormMediaPreference();
  const display = exerciseFormMediaDisplayOf(formMediaToShow(mediaSetOf(exercise), preference));

  switch (display.kind) {
    case "video":
      return <FormMediaCard {...display} />;
    case "photos":
    case "both":
      return <FormMediaCard {...display} exerciseName={exercise.exerciseName} />;
    // The schema refuses `none`, so this only keeps the switch complete.
    case "none":
      return null;
  }
});

/** What the event carries, as the set the core chooser reads: a video card may also carry the two photos. */
function mediaSetOf({ media }: ExerciseFormEntryProps["exercise"]): ExerciseFormMediaSet {
  if (media.kind === "photos") {
    return { video: null, photos: { imagePaths: media.imagePaths } };
  }
  const { videoId, title, channel, imagePaths } = media;
  return {
    video: { videoId, title, channel },
    photos: imagePaths === undefined ? null : { imagePaths },
  };
}
