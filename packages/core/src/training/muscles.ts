/*
 * The muscle list of ADR 0005 ("The muscle list is the contract"). The same ids name the `muscles` rows the
 * migration seeds (KEY-347), the regions of the 2D body map and the meshes of the 3D model. Adding or
 * splitting an id is a new list version and a migration, never an edit in place. If this file and the ADR
 * ever differ, the ADR wins.
 */

/** The version of the accepted muscle list that `MUSCLE_IDS` holds. A snapshot records it. */
export const MUSCLE_LIST_VERSION = 1;

/** The 22 muscle ids, in the order of the accepted list, which is also the `muscles.position` order. */
export const MUSCLE_IDS = [
  "chest_upper",
  "chest_lower",
  "delt_front",
  "delt_side",
  "delt_rear",
  "lats",
  "traps_upper",
  "traps_mid",
  "lower_back",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "obliques",
  "glute_max",
  "glute_med",
  "quads",
  "hamstrings",
  "adductors",
  "calves",
  "tibialis",
  "neck",
] as const;

export type MuscleId = (typeof MUSCLE_IDS)[number];

/** The `muscle_group` enum of ADR 0005, Amendment 1, in the order of the accepted list. */
export const MUSCLE_GROUPS = [
  "chest",
  "shoulders",
  "back",
  "arms",
  "core",
  "legs",
  "neck",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** The `muscle_size_class` enum. It picks a muscle's starting values in the heat model. */
export const MUSCLE_SIZE_CLASSES = ["small", "medium", "large"] as const;

export type MuscleSizeClass = (typeof MUSCLE_SIZE_CLASSES)[number];

export type MuscleDetails = {
  group: MuscleGroup;
  sizeClass: MuscleSizeClass;
};

/**
 * Each muscle's group (the accepted list) and size class (the table in "The heat model"), as the
 * migration seeds them.
 */
export const MUSCLES: Readonly<Record<MuscleId, Readonly<MuscleDetails>>> = {
  chest_upper: { group: "chest", sizeClass: "medium" },
  chest_lower: { group: "chest", sizeClass: "medium" },
  delt_front: { group: "shoulders", sizeClass: "small" },
  delt_side: { group: "shoulders", sizeClass: "small" },
  delt_rear: { group: "shoulders", sizeClass: "small" },
  lats: { group: "back", sizeClass: "medium" },
  traps_upper: { group: "back", sizeClass: "medium" },
  traps_mid: { group: "back", sizeClass: "medium" },
  lower_back: { group: "back", sizeClass: "large" },
  biceps: { group: "arms", sizeClass: "small" },
  triceps: { group: "arms", sizeClass: "small" },
  forearms: { group: "arms", sizeClass: "small" },
  abs: { group: "core", sizeClass: "small" },
  obliques: { group: "core", sizeClass: "small" },
  glute_max: { group: "legs", sizeClass: "large" },
  glute_med: { group: "legs", sizeClass: "medium" },
  quads: { group: "legs", sizeClass: "large" },
  hamstrings: { group: "legs", sizeClass: "large" },
  adductors: { group: "legs", sizeClass: "medium" },
  calves: { group: "legs", sizeClass: "small" },
  tibialis: { group: "legs", sizeClass: "small" },
  neck: { group: "neck", sizeClass: "small" },
};

const muscleIds: readonly string[] = MUSCLE_IDS;

/** Whether `value` is one of the 22 muscle ids of the current list. */
export const isMuscleId = (value: unknown): value is MuscleId =>
  typeof value === "string" && muscleIds.includes(value);
