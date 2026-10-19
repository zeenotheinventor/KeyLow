type Row = Record<string, unknown>;

/*
 * The `session · add-exercise` board's search for "lateral raise" as the database returns it: the person's own
 * "Lean-away cable raise" first, then the four library exercises by name.
 */

const exercise = (
  n: number,
  name: string,
  equipment: string,
  muscles: readonly (readonly [string, "primary" | "secondary"])[],
  source: "user" | "free_exercise_db" = "free_exercise_db",
): Row => ({
  id: `0000000a-0000-4000-8000-${String(n).padStart(12, "0")}`,
  name,
  equipment,
  mechanic: "isolation",
  source,
  exercise_muscles: muscles.map(([muscle_id, role]) => ({
    muscle_id,
    role,
    weight: role === "primary" ? 1 : 0.5,
  })),
});

export const SIDE_LATERAL_RAISE_ID = "0000000a-0000-4000-8000-000000000002";

export const lateralRaiseExercises: Row[] = [
  exercise(
    1,
    "Lean-away cable raise",
    "cable",
    [
      ["delt_side", "primary"],
      ["traps_upper", "secondary"],
    ],
    "user",
  ),
  exercise(2, "Side lateral raise", "dumbbell", [["delt_side", "primary"]]),
  exercise(3, "Cable lateral raise", "cable", [["delt_side", "primary"]]),
  exercise(4, "Upright barbell row", "barbell", [
    ["delt_side", "primary"],
    ["traps_upper", "secondary"],
  ]),
  exercise(5, "Power partials", "dumbbell", [["delt_side", "primary"]]),
];
