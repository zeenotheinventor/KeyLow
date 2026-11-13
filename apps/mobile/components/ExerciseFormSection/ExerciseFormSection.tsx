import { exerciseFormMediaDisplayOf, formMediaToShow } from "@keylow/core/training";
import { useState } from "react";
import { View } from "react-native";

import { useExerciseFormMedia } from "../../lib/exerciseFormMedia";
import { useFormMediaPreference } from "../../lib/formMediaPreference";
import { FormMediaCard } from "../ui";

import type { ExerciseFormSectionProps } from "./types";
import type { ExerciseFormMediaState } from "../../lib/exerciseFormMedia";
import type { FormMediaCardProps, FormMediaPreferenceSwitch } from "../ui";

/**
 * How the exercise is done, as the boards `exercise-form · session-exercise-sheet` and
 * `session-exercise-sheet-both` place it: the shared form card, with the video, or the start and end photos,
 * or both, as the Exercise demos preference says, or the loading card while the read is out, or the
 * unavailable card when the phone is offline or the read failed. An exercise with both kinds also gets the
 * quick switch under the media, which changes that same preference. An exercise with nothing to show draws
 * nothing, not even its spacing, so its sheet is the one it was before the form was added. The form media
 * is read only while `isOpen`, and the card it last showed stays on show through the sheet's exit.
 *
 * The padding is the sheet body's gap (12) less the 2 the heading block already keeps between its lines, on
 * both sides, so the card sits 12 from the name and from the caption under it.
 */
export function ExerciseFormSection({
  exerciseId,
  exerciseName,
  isOpen,
}: ExerciseFormSectionProps) {
  const media = useExerciseFormMedia({ exerciseId, isOpen });
  const { preference, isReady, setPreference } = useFormMediaPreference();
  // Until the preference has been read the media would be drawn as the default and then jump, so it waits.
  const live: ExerciseFormMediaState =
    media.status === "ready" && !isReady ? { status: "loading" } : media;
  // Set while rendering on purpose, so the state is kept in the render it arrives in. A closed sheet reads
  // nothing and so says loading, which would turn an offline card to a skeleton as the sheet leaves.
  const [lastOpenState, setLastOpenState] = useState(live);
  if (isOpen && !isSameState(live, lastOpenState)) {
    setLastOpenState(live);
  }
  const card = cardOf(isOpen ? live : lastOpenState, exerciseName, {
    value: preference,
    onChange: setPreference,
  });

  return card === null ? null : (
    <View className="py-[10px]">
      <FormMediaCard {...card} />
    </View>
  );
}

function isSameState(first: ExerciseFormMediaState, second: ExerciseFormMediaState): boolean {
  if (first.status === "ready" && second.status === "ready") {
    return first.media === second.media;
  }
  return first.status === second.status;
}

/** What the card draws for what the read has so far, or null when there is nothing to show. */
function cardOf(
  state: ExerciseFormMediaState,
  exerciseName: string,
  preferenceSwitch: FormMediaPreferenceSwitch,
): FormMediaCardProps | null {
  switch (state.status) {
    case "loading":
      return { kind: "loading" };
    case "offline":
    case "failed":
      return { kind: "unavailable" };
    case "ready": {
      const display = exerciseFormMediaDisplayOf(
        formMediaToShow(state.media, preferenceSwitch.value),
      );
      // With only one kind there is nothing to switch to, whatever the preference says.
      const hasBothKinds = state.media.video !== null && state.media.photos !== null;
      const switchOfCard = hasBothKinds ? { preferenceSwitch } : {};
      switch (display.kind) {
        case "photos":
        case "both":
          return { ...display, exerciseName, ...switchOfCard };
        case "video":
          return { ...display, ...switchOfCard };
        case "none":
          return null;
      }
    }
  }
}
