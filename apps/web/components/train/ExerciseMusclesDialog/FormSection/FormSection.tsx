import { useExerciseFormMedia, useRecordAchievementEvent } from "@keylow/api-client";
import { exerciseFormMediaDisplayOf, formMediaToShow } from "@keylow/core/training";
import { useEffect } from "react";

import type { FormSectionProps } from "./types";

import { FormMediaCard } from "@/components/ui/FormMediaCard";
import { useIsOnline } from "@/lib/useIsOnline";

/**
 * How the exercise is done, above its muscles in the dialog: the form media card with the video, or the
 * start and end photos, or the loading card while the read is out, or the unavailable card when the read
 * failed or there is no connection. An exercise with nothing to show draws nothing, so its dialog is the one
 * it was before. The dialog is mounted when it opens, so the media is read only then.
 */
export function FormSection({ exerciseId, exerciseName }: FormSectionProps) {
  const state = useExerciseFormMedia({
    exerciseId,
    isOpen: true,
    isOnline: useIsOnline(),
    enabled: true,
  });

  const recordEvent = useRecordAchievementEvent();
  // A demo is on show once the exercise has a video or photos to draw.
  const isDemoShown =
    state.status === "ready" && (state.media.video !== null || state.media.photos !== null);
  useEffect(() => {
    if (isDemoShown) {
      recordEvent("exercise_demo_opened", exerciseId);
    }
  }, [isDemoShown, exerciseId, recordEvent]);

  switch (state.status) {
    case "loading":
      return <FormMediaCard kind="loading" />;
    case "offline":
    case "failed":
      return <FormMediaCard kind="unavailable" />;
    case "ready": {
      const display = exerciseFormMediaDisplayOf(formMediaToShow(state.media, "video"));
      switch (display.kind) {
        case "video":
          return <FormMediaCard {...display} />;
        case "photos":
          return <FormMediaCard {...display} exerciseName={exerciseName} />;
        case "none":
          return null;
      }
    }
  }
}
