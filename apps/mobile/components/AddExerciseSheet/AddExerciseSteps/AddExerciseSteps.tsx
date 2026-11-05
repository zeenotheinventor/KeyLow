import { useState } from "react";

import { AddExercisePicker } from "../AddExercisePicker";
import { CustomExerciseForm } from "../CustomExerciseForm";

import type { AddExerciseStepsProps } from "./types";
import type { ChosenExercise } from "../types";

/**
 * What is inside the Add exercise sheet: the picker and, once the `Create "…"` row is pressed, the New
 * exercise form in its place. Only one is drawn at a time, because a gorhom sheet takes one scrollable. The
 * words searched for are kept, so Back from the form returns to the same search. It is mounted only while
 * the sheet is open, so each opening starts at an empty search.
 */
export function AddExerciseSteps({ destination, onChoose, onClose }: AddExerciseStepsProps) {
  const [searchedWords, setSearchedWords] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  function choose(exercise: ChosenExercise) {
    onChoose(exercise);
    onClose();
  }

  if (isCreating) {
    return (
      <CustomExerciseForm
        destination={destination}
        initialName={searchedWords}
        onBack={() => {
          setIsCreating(false);
        }}
        onSaved={choose}
      />
    );
  }

  return (
    <AddExercisePicker
      initialQuery={searchedWords}
      onChoose={choose}
      onClose={onClose}
      onCreate={(words) => {
        setSearchedWords(words);
        setIsCreating(true);
      }}
    />
  );
}
