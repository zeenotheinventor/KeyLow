import type { ExerciseMuscleEntry, TrainingGoalsRow } from "../../schemas/training";
import type { Equipment, ExerciseMechanic } from "../enums";
import type { MuscleId } from "../muscles";
import type { MuscleState } from "../muscleState";

/*
 * What `suggestSession` takes and gives (ADR 0005, "Goals and suggestions"). Reasons and skipped muscles
 * are data: muscle ids and the numbers behind a pick, never an exercise name or a sentence, so a screen
 * and a later assistant can explain a suggestion without recomputing it.
 */

/** What the score reads of a muscle: `muscleState`'s record, whose other fields are ignored. */
export type SuggestState = Readonly<Record<MuscleId, Pick<MuscleState, "heat" | "weeklySets">>>;

/** What the score and the targets read of the current `training_goals` row. */
export type SuggestGoals = Pick<
  TrainingGoalsRow,
  "goal" | "experience" | "equipment" | "session_minutes" | "muscle_priority"
>;

/** An exercise of the library, with the muscle map the score reads. */
export type SuggestExercise = Readonly<{
  id: string;
  name: string;
  equipment: Equipment;
  mechanic: ExerciseMechanic;
  muscles: readonly ExerciseMuscleEntry[];
}>;

/**
 * A screen may narrow what the goal says. A field left out falls back to the goal's. Equipment is
 * intersected with the goal's, so a screen can never widen it: a dumbbell-only goal never gets a barbell
 * exercise. Minutes replace the goal's.
 */
export type SuggestConstraints = Readonly<{
  minutes?: number;
  equipment?: readonly Equipment[];
}>;

/** The numbers behind a pick, for one muscle, as they stood when the exercise was chosen. Data, not text. */
export type SuggestionReason = Readonly<{
  muscle_id: MuscleId;
  priority: number;
  /** The sets of the last 7 days plus the sets already given by earlier picks of this suggestion. */
  weekly_sets: number;
  mav_low: number;
  heat: number;
  score: number;
}>;

export type SuggestedExercise = Readonly<{
  exercise_id: string;
  sets: number;
  rep_min: number;
  rep_max: number;
  target_rir: number;
  origin: "added";
  /** The exercise's primary muscles that still scored, the one that led the pick first. */
  reasons: readonly SuggestionReason[];
}>;

/** A muscle that scored but was left out because it is hot: no exercise with it as a primary muscle is used. */
export type SkippedMuscle = Readonly<{ muscle_id: MuscleId; heat: number }>;

/** The muscle that would have led the next pick, and the length the session would have read with it. */
export type NoRoom = Readonly<{
  muscle_id: MuscleId;
  score: number;
  minutes_if_added: number;
}>;

export type SuggestedSession = Readonly<{
  kind: "session";
  exercises: readonly SuggestedExercise[];
  sets: number;
  minutes: number;
  skipped: readonly SkippedMuscle[];
  no_room: NoRoom | null;
}>;

/** Why nothing is suggested, other than the minutes. */
export type OtherNothingReason = "priorities_covered" | "all_hot" | "no_exercise";

/**
 * Why nothing is suggested: no muscle has a gap to fill (`priorities_covered`), the first exercise would
 * not fit the minutes (`no_room`), every exercise for the muscles with a gap has a hot primary muscle
 * (`all_hot`), or the library has no exercise for them in the user's equipment (`no_exercise`).
 */
export type NothingReason = OtherNothingReason | "no_room";

/** Nothing, because not even the first exercise fits: `no_room` says which muscle and how long it would read. */
export type NothingForNoRoom = Readonly<{
  kind: "nothing";
  why: "no_room";
  skipped: readonly SkippedMuscle[];
  no_room: NoRoom;
}>;

export type NothingForOtherReason = Readonly<{
  kind: "nothing";
  why: OtherNothingReason;
  skipped: readonly SkippedMuscle[];
  no_room: null;
}>;

export type NothingToSuggest = NothingForNoRoom | NothingForOtherReason;

export type Suggestion = SuggestedSession | NothingToSuggest;
