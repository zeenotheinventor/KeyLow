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
