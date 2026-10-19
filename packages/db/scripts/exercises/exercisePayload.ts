import type { ImportRow } from "./importExercise";
import type { Json } from "../../src/types.gen";

/** One exercise as `public.import_exercises` takes it. The Supabase store and the migration file both write exactly this. */
export const toExercisePayload = ({
  sourceRef,
  name,
  equipment,
  mechanic,
  muscles,
  raw,
}: ImportRow): Json => ({
  source_ref: sourceRef,
  name,
  equipment,
  mechanic,
  muscles: muscles.map(({ muscleId, role, weight }) => ({
    muscle_id: muscleId,
    role,
    weight,
  })),
  raw,
});
