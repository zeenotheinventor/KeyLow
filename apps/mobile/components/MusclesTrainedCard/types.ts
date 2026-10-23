import type { HeatSet } from "@keylow/core/training";

export type MusclesTrainedCardProps = {
  /** The sets of the session, and of the session alone: the card shows what it did, with no fatigue from earlier days. */
  sets: readonly HeatSet[];
  /** The moment the figures' heat is read at, as an ISO timestamp with a zone: the session's end. */
  at: string;
};

export type TrainedMuscleRowProps = {
  /** The muscle's name. */
  name: string;
  /** Its effective sets in words: "5.5 sets". */
  value: string;
  /** The heat step of its swatch, from 0 to 5. */
  heatStep: number;
};
