import type { MuscleGroup, MuscleId } from "../training/muscles";

/** The name of each muscle, as the `body · muscle-list` board writes it. */
export const MUSCLE_NAMES: Readonly<Record<MuscleId, string>> = {
  chest_upper: "Upper chest",
  chest_lower: "Lower chest",
  delt_front: "Front delts",
  delt_side: "Side delts",
  delt_rear: "Rear delts",
  lats: "Lats",
  traps_upper: "Upper traps",
  traps_mid: "Mid traps",
  lower_back: "Lower back",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abs: "Abs",
  obliques: "Obliques",
  glute_max: "Glutes",
  glute_med: "Side glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  adductors: "Adductors",
  calves: "Calves",
  tibialis: "Shins",
  neck: "Neck",
};

/** Whether the muscle's name reads as one thing ("neck") or many ("abs", "lats"), which the sentences agree with. */
export const NAME_NUMBER: Readonly<Record<MuscleId, "one" | "many">> = {
  chest_upper: "one",
  chest_lower: "one",
  delt_front: "many",
  delt_side: "many",
  delt_rear: "many",
  lats: "many",
  traps_upper: "many",
  traps_mid: "many",
  lower_back: "one",
  biceps: "many",
  triceps: "many",
  forearms: "many",
  abs: "many",
  obliques: "many",
  glute_max: "many",
  glute_med: "many",
  quads: "many",
  hamstrings: "many",
  adductors: "many",
  calves: "many",
  tibialis: "many",
  neck: "one",
};

/** The name of each muscle group, as the `body · muscle-list` board writes its section headings. */
export const MUSCLE_GROUP_NAMES: Readonly<Record<MuscleGroup, string>> = {
  chest: "Chest",
  shoulders: "Shoulders",
  back: "Back",
  arms: "Arms",
  core: "Core",
  legs: "Legs",
  neck: "Neck",
};
