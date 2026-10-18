// The shape of one entry of free-exercise-db's dist/exercises.json, checked field by field so that a
// different upstream file fails loudly instead of curating nonsense.

/** The 17 muscle groups free-exercise-db uses in primaryMuscles and secondaryMuscles. */
export const SOURCE_MUSCLE_GROUPS = [
  "abdominals",
  "abductors",
  "adductors",
  "biceps",
  "calves",
  "chest",
  "forearms",
  "glutes",
  "hamstrings",
  "lats",
  "lower back",
  "middle back",
  "neck",
  "quadriceps",
  "shoulders",
  "traps",
  "triceps",
] as const;

export type SourceMuscleGroup = (typeof SOURCE_MUSCLE_GROUPS)[number];

export interface SourceExercise {
  id: string;
  name: string;
  category: string;
  equipment: string | null;
  mechanic: string | null;
  force: string | null;
  primaryMuscles: SourceMuscleGroup[];
  secondaryMuscles: SourceMuscleGroup[];
  instructions: string[];
}

const groups: ReadonlySet<string> = new Set(SOURCE_MUSCLE_GROUPS);

const isSourceMuscleGroup = (value: string): value is SourceMuscleGroup => groups.has(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function readString(entry: Record<string, unknown>, key: string, where: string): string {
  const value = entry[key];
  if (typeof value !== "string" || value === "") {
    throw new Error(`${where}: ${key} is not a non-empty string`);
  }
  return value;
}

function readNullableString(
  entry: Record<string, unknown>,
  key: string,
  where: string,
): string | null {
  const value = entry[key];
  if (value !== null && typeof value !== "string") {
    throw new Error(`${where}: ${key} is neither a string nor null`);
  }
  return value;
}

function readGroups(
  entry: Record<string, unknown>,
  key: string,
  where: string,
): SourceMuscleGroup[] {
  const value = entry[key];
  if (!Array.isArray(value)) {
    throw new Error(`${where}: ${key} is not a list`);
  }
  return value.map((group: unknown) => {
    if (typeof group !== "string" || !isSourceMuscleGroup(group)) {
      throw new Error(
        `${where}: ${key} holds "${String(group)}", which is not a known muscle group`,
      );
    }
    return group;
  });
}

export function parseSourceExercises(json: string): SourceExercise[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error("The source file is not a JSON list");
  }
  return parsed.map((entry: unknown, index) => {
    const where = `entry ${index}`;
    if (!isRecord(entry)) {
      throw new Error(`${where} is not an object`);
    }
    const instructions = entry["instructions"];
    if (!Array.isArray(instructions) || !instructions.every((step) => typeof step === "string")) {
      throw new Error(`${where}: instructions is not a list of strings`);
    }
    return {
      id: readString(entry, "id", where),
      name: readString(entry, "name", where),
      category: readString(entry, "category", where),
      equipment: readNullableString(entry, "equipment", where),
      mechanic: readNullableString(entry, "mechanic", where),
      force: readNullableString(entry, "force", where),
      primaryMuscles: readGroups(entry, "primaryMuscles", where),
      secondaryMuscles: readGroups(entry, "secondaryMuscles", where),
      instructions: instructions,
    };
  });
}
