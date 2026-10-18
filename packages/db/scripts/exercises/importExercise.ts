import type { Equipment, Mechanic } from "./columns";
import type { MuscleId, Role } from "./muscles";
import type { Json } from "../../src/types.gen";

export type ImportMuscle = { muscleId: MuscleId; role: Role; weight: number };

/** One global exercise as the curated CSV describes it. */
export type ImportExercise = {
  sourceRef: string;
  name: string;
  equipment: Equipment;
  mechanic: Mechanic;
  muscles: ImportMuscle[];
};

/** An exercise with the source row it came from, which is what a store writes. */
export type ImportRow = ImportExercise & { raw: Json };
