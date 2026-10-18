// Turns the pinned free-exercise-db file and the hand overrides into the curated and excluded CSVs.
// Pure and deterministic: the same two inputs always give the same bytes, rows sorted by source_ref.
import { CURATED_COLUMNS, EXCLUDED_COLUMNS } from "./columns";
import { MUSCLE_IDS } from "./muscles";
import { formatMuscleShares } from "./muscleShares";
import { parseOverrides } from "./overrides";
import { categoryExclusion, mapEquipment, mapExerciseMuscles, mapMechanic } from "./rules";
import { parseSourceExercises } from "./sourceExercise";
import { formatCsv } from "../cofid/csv";

import type { MuscleId } from "./muscles";
import type { MuscleShare } from "./muscleShares";
import type { SourceExercise } from "./sourceExercise";

export interface CuratedExercise {
  sourceRef: string;
  name: string;
  equipment: string;
  mechanic: "compound" | "isolation";
  muscles: MuscleShare[];
  overrideNote: string;
}

export interface ExcludedExercise {
  sourceRef: string;
  name: string;
  category: string;
  reason: string;
}

export interface CurationResult {
  curated: CuratedExercise[];
  excluded: ExcludedExercise[];
  curatedCsv: string;
  excludedCsv: string;
  /** How many curated exercises have each muscle as primary, in the ADR's muscle order. */
  primaryCounts: Record<MuscleId, number>;
}

const byCodeUnits = (first: string, second: string): number =>
  first < second ? -1 : first > second ? 1 : 0;

export function curateExercises(sourceJson: string, overridesCsv: string): CurationResult {
  const exercises = parseSourceExercises(sourceJson).sort((first, second) =>
    byCodeUnits(first.id, second.id),
  );
  const overrides = parseOverrides(overridesCsv);

  const ids = new Set(exercises.map(({ id }) => id));
  if (ids.size !== exercises.length) {
    throw new Error("The source file has two exercises with the same id");
  }
  for (const sourceRef of overrides.keys()) {
    if (!ids.has(sourceRef)) {
      throw new Error(`overrides.csv names ${sourceRef}, which is not in the source file`);
    }
  }

  const curated: CuratedExercise[] = [];
  const excluded: ExcludedExercise[] = [];
  const exclude = (exercise: SourceExercise, reason: string): void => {
    excluded.push({
      sourceRef: exercise.id,
      name: exercise.name,
      category: exercise.category,
      reason,
    });
  };
  // Two kept exercises with the same, non-empty instructions are one exercise; the first by id stays.
  const keptByInstructions = new Map<string, string>();

  for (const exercise of exercises) {
    const override = overrides.get(exercise.id);
    const ruleExclusion = categoryExclusion(exercise);

    if (override?.action === "exclude") {
      exclude(exercise, override.note);
      continue;
    }
    if (ruleExclusion !== undefined && override?.action !== "include") {
      if (override?.action === "map") {
        throw new Error(`overrides.csv maps ${exercise.id}, which the rules exclude; use include`);
      }
      exclude(exercise, ruleExclusion);
      continue;
    }
    if (override?.action === "include" && ruleExclusion === undefined) {
      throw new Error(
        `overrides.csv includes ${exercise.id}, which the rules already keep; use map`,
      );
    }

    const instructions = exercise.instructions.join(" ").trim();
    const duplicateOf = instructions === "" ? undefined : keptByInstructions.get(instructions);
    if (duplicateOf !== undefined) {
      if (override !== undefined) {
        throw new Error(`overrides.csv names ${exercise.id}, a duplicate of ${duplicateOf}`);
      }
      exclude(exercise, `duplicate of ${duplicateOf}`);
      continue;
    }
    if (instructions !== "") {
      keptByInstructions.set(instructions, exercise.id);
    }

    curated.push({
      sourceRef: exercise.id,
      name: exercise.name,
      equipment: mapEquipment(exercise),
      mechanic: mapMechanic(exercise),
      muscles: override?.muscles ?? mapExerciseMuscles(exercise),
      overrideNote: override?.note ?? "",
    });
  }

  const primaryCounts = Object.fromEntries(MUSCLE_IDS.map((muscle) => [muscle, 0])) as Record<
    MuscleId,
    number
  >;
  for (const exercise of curated) {
    for (const { muscle, role } of exercise.muscles) {
      if (role === "primary") {
        primaryCounts[muscle] += 1;
      }
    }
  }

  return {
    curated,
    excluded,
    curatedCsv: formatCsv([
      [...CURATED_COLUMNS],
      ...curated.map((exercise) => [
        exercise.sourceRef,
        exercise.name,
        exercise.equipment,
        exercise.mechanic,
        formatMuscleShares(exercise.muscles),
        exercise.overrideNote,
      ]),
    ]),
    excludedCsv: formatCsv([
      [...EXCLUDED_COLUMNS],
      ...excluded.map(({ sourceRef, name, category, reason }) => [
        sourceRef,
        name,
        category,
        reason,
      ]),
    ]),
    primaryCounts,
  };
}
