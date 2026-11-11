export type ExerciseFormSectionProps = {
  exerciseId: string;
  /** The exercise's name, which names its photos for a screen reader. */
  exerciseName: string;
  /** Whether the sheet that holds the section is open. The form media is read only while it is. */
  isOpen: boolean;
};
