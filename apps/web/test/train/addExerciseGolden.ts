type Row = Record<string, unknown>;

/*
 * The exercises of the `session · add-exercise` board (KEY-463) as the database returns a search for them:
 * the person's own Lean-away cable raise first, then four library rows.
 */

const exerciseRow = (
  n: number,
  name: string,
  equipment: string,
  source: "user" | "free_exercise_db",
  muscles: readonly (readonly [string, "primary" | "secondary"])[],
): Row => ({
  id: `0000000a-0000-4000-8000-${String(n).padStart(12, "0")}`,
  name,
  equipment,
  mechanic: "isolation",
  source,
  exercise_muscles: muscles.map(([muscleId, role]) => ({
    muscle_id: muscleId,
    role,
    weight: role === "primary" ? 1 : 0.5,
  })),
});

export const lateralRaiseResults: Row[] = [
  exerciseRow(1, "Lean-away cable raise", "cable", "user", [
    ["delt_side", "primary"],
    ["traps_upper", "secondary"],
  ]),
  exerciseRow(2, "Side lateral raise", "dumbbell", "free_exercise_db", [["delt_side", "primary"]]),
  exerciseRow(3, "Cable lateral raise", "cable", "free_exercise_db", [["delt_side", "primary"]]),
  exerciseRow(4, "Upright barbell row", "barbell", "free_exercise_db", [
    ["delt_side", "primary"],
    ["traps_upper", "secondary"],
  ]),
  exerciseRow(5, "Power partials", "dumbbell", "free_exercise_db", [["delt_side", "primary"]]),
];
