import { EQUIPMENT_OPTIONS } from "./goals";
import { describeCountedHeading } from "./recipeEditor";
import { formatScaledCount } from "../format/scaledCount";
import { characterCount } from "../recipes/characterCount";
import { MAX_EXERCISE_NAME_LENGTH, MAX_MUSCLES_PER_EXERCISE } from "../training/bounds";
import { EQUIPMENT } from "../training/enums";

import type { CustomExerciseIssue, CustomExerciseRule } from "../training/customExercise";
import type { Equipment, MuscleRole } from "../training/enums";

/*
 * The words of the Add exercise sheet and the New exercise form (KEY-413, canvas version 30), as the boards
 * `session · add-exercise` and `session · custom-exercise` draw them, except where a doc says no board draws
 * a sentence. Data in, sentence out. An exercise name and its muscles are health data, so none of these
 * throws with one in its message, and the rule sentences state the rule and never what was entered.
 */

/** The fixed words of the Add exercise sheet. */
export const ADD_EXERCISE = {
  title: "Add exercise",
  closeName: "Close",
  searchName: "Search exercises",
  clearSearchName: "Clear search",
  customPill: "Custom",
  /** The line when no exercise matches. The boards do not draw it. */
  noResults: "No exercise matches your search.",
  /** The line when the search fails with a connection, so a failure is not read as no matches. The boards do not draw it. */
  exerciseSearchFailed: "The search did not load. Check your connection, then try again.",
  /** The line when the phone is offline and the search cannot run. The boards do not draw it. */
  exerciseSearchOffline:
    "Searching exercises needs a connection. Try again when you're back online.",
} as const;

const GROUP_HEADINGS = { yours: "Your exercises", library: "Library" } as const;

/** A group's heading with the count the caller found: "Your exercises · 1", "Library · 4". */
export const describeExerciseGroupHeading = (
  group: keyof typeof GROUP_HEADINGS,
  count: number,
): string => describeCountedHeading(GROUP_HEADINGS[group], count);

/** The name of a row's add button: "Add Side lateral raise". */
export const describeAddExerciseName = (exerciseName: string): string => `Add ${exerciseName}`;

/**
 * The name of a row's button: "Add Side lateral raise, Dumbbell", and ", Custom" after the equipment for
 * the person's own exercise, so a screen reader hears what the row is and what pressing it does.
 */
export const describeExerciseRowName = ({
  name,
  equipment,
  isCustom,
}: Readonly<{ name: string; equipment: Equipment; isCustom: boolean }>): string =>
  [
    describeAddExerciseName(name),
    EQUIPMENT_OPTIONS[equipment].label,
    ...(isCustom ? [ADD_EXERCISE.customPill] : []),
  ].join(", ");

const CREATE_HELP = "Your own exercise, with the muscles it works";

/**
 * The row that offers to create the exercise searched for: `Create "lateral raise"`. A blank search
 * gives the row without a name, which the boards do not draw.
 */
export const describeCreateExerciseRow = (
  query: string,
): Readonly<{ title: string; help: string }> => {
  const name = query.trim();
  return { title: name === "" ? "Create an exercise" : `Create "${name}"`, help: CREATE_HELP };
};

/** The equipment chips, one for each value, in the order of the enum and the goals chips. */
const EQUIPMENT_CHIPS: readonly Readonly<{ value: Equipment; label: string }>[] = EQUIPMENT.map(
  (value) => ({ value, label: EQUIPMENT_OPTIONS[value].label }),
);

/** The fixed words of the New exercise form. */
export const CUSTOM_EXERCISE = {
  title: "New exercise",
  backName: "Back to Add exercise",
  nameLabel: "Name",
  equipmentLabel: "Equipment",
  equipmentOptions: EQUIPMENT_CHIPS,
  musclesHeading: "Muscles it works",
  musclesHint: "At least one primary",
  addMuscleAction: "Add a muscle",
  roleExplanation:
    "A set counts in full for a primary muscle, half for a secondary and a fifth for an assisting one.",
  privacyNote: "Only you see your own exercises.",
} as const;

/** The role control's labels and what each role counts for. Core weighs them 1, a half and a fifth. */
export const CUSTOM_EXERCISE_ROLES: Readonly<
  Record<MuscleRole, Readonly<{ label: string; help: string }>>
> = {
  primary: { label: "Primary", help: "Primary · counts 1 set" },
  secondary: { label: "Second", help: "Secondary · counts half" },
  stabiliser: { label: "Assist", help: "Assisting · counts a fifth" },
};

/** The name counter: "21 / 200". Counted in code points and trimmed, as the name is saved. */
export const describeExerciseNameLength = (name: string): string =>
  `${formatScaledCount(characterCount(name.trim()))} / ${formatScaledCount(MAX_EXERCISE_NAME_LENGTH)}`;

/** The names of a muscle row's role control and remove button. */
export const describeMuscleRowNames = (
  muscleName: string,
): Readonly<{ role: string; remove: string }> => ({
  role: `Role for ${muscleName}`,
  remove: `Remove ${muscleName}`,
});

export type SaveCustomExerciseDestination =
  Readonly<{ kind: "session"; dayName: string | null }> | Readonly<{ kind: "routine" }>;

/**
 * The save button: "Save and add to Legs" for a session, "Save and add" for a routine. A session that
 * follows no routine day says this session. The boards draw the first only.
 */
export const describeSaveCustomExerciseAction = (
  destination: SaveCustomExerciseDestination,
): string => {
  if (destination.kind === "routine") {
    return "Save and add";
  }
  return `Save and add to ${destination.dayName ?? "this session"}`;
};

/** Every `CustomExerciseRule` has its sentence, so a rule added without one does not compile. */
const RULE_SENTENCES: Record<CustomExerciseRule, string> = {
  name_blank: "Give the exercise a name.",
  name_too_long: `Use ${MAX_EXERCISE_NAME_LENGTH} characters or fewer for the exercise name.`,
  equipment_invalid: "Pick the equipment it uses.",
  muscles_none: "Add at least one muscle it works.",
  muscles_too_many: `An exercise can work ${MAX_MUSCLES_PER_EXERCISE} muscles at most.`,
  muscle_unknown: "Pick each muscle from the list.",
  muscle_role_invalid: "Pick Primary, Second or Assist for each muscle.",
  muscle_repeated: "Add each muscle once.",
  primary_missing: "Mark at least one muscle as primary.",
};

/** The sentence for a problem `validateCustomExerciseDraft` found. It states the rule and never a value. */
export const describeCustomExerciseIssue = ({ rule }: CustomExerciseIssue): string =>
  RULE_SENTENCES[rule];
