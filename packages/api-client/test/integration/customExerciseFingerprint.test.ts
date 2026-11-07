import { customExercisePayload, validateCustomExerciseDraft } from "@keylow/core/training";
import { afterAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";

import type { CustomExerciseDraft } from "@keylow/core/training";

// The assistant's `save_custom_exercise` works out the fingerprint of what it saved from its input, and reads
// nothing back. Undo later reads the exercise and compares fingerprints, so they must be equal for what the
// database stores. This calls `save_exercise` as the tool does, with the arguments core builds, and reads the
// exercise the way `readExerciseState` does. The user is new for the run and its rows go with it. Every name
// is key905- plus a random suffix.

afterAll(async () => {
  await deleteCreatedTestUsers();
});

type Stored = {
  name: string;
  equipment: string;
  mechanic: string;
  muscles: { muscle_id: string; role: string; weight: number }[];
  isArchived: boolean;
};

// The body of `exerciseFingerprint` in `packages/db/supabase/functions/_shared/assistant/tools/exerciseWrite.ts`,
// which runs under Deno and cannot be imported here. Keep the two the same.
const exerciseFingerprint = (exercise: Stored): string =>
  JSON.stringify([
    exercise.name,
    exercise.equipment,
    exercise.mechanic,
    exercise.isArchived,
    [...exercise.muscles]
      .sort((first, second) => first.muscle_id.localeCompare(second.muscle_id))
      .map(({ muscle_id, role, weight }) => [muscle_id, role, weight]),
  ]);

const uniqueName = (label: string) => `key905-${label}-${crypto.randomUUID()}`;

async function fingerprintsOf(draft: CustomExerciseDraft) {
  const owner = await createTestUser("key905");
  const checked = validateCustomExerciseDraft(draft);
  if (!checked.ok) {
    throw new Error("The draft is not valid");
  }
  const { p_exercise, p_muscles } = customExercisePayload(checked.value);
  // The generated types name the id a string, and null adds. The tool sends the same.
  const saved = await owner.client.rpc("save_exercise", {
    p_exercise_id: null as unknown as string,
    p_exercise,
    p_muscles: [...p_muscles],
  });
  expect(saved.error).toBeNull();

  const read = await owner.client
    .from("exercises")
    .select("name,equipment,mechanic,source,deleted_at,exercise_muscles(muscle_id,role,weight)")
    .eq("id", saved.data ?? "")
    .maybeSingle();
  expect(read.error).toBeNull();
  const row = read.data;
  if (row === null) {
    throw new Error("The saved exercise cannot be read");
  }
  return {
    fromInput: exerciseFingerprint({
      name: p_exercise.name,
      equipment: p_exercise.equipment,
      mechanic: p_exercise.mechanic,
      muscles: [...p_muscles],
      isArchived: false,
    }),
    fromRead: exerciseFingerprint({
      name: row.name,
      equipment: row.equipment,
      mechanic: row.mechanic,
      muscles: row.exercise_muscles,
      isArchived: row.deleted_at !== null,
    }),
  };
}

describe("the fingerprint of a saved custom exercise", () => {
  it("should be the same from the input as from the read, for a primary muscle only", async () => {
    const { fromInput, fromRead } = await fingerprintsOf({
      name: uniqueName("primary"),
      equipment: "cable",
      muscles: [{ muscle_id: "abs", role: "primary" }],
    });

    expect(fromRead).toBe(fromInput);
  });

  it("should be the same for a primary, a secondary and an assisting muscle", async () => {
    const { fromInput, fromRead } = await fingerprintsOf({
      name: uniqueName("roles"),
      equipment: "barbell",
      muscles: [
        { muscle_id: "hamstrings", role: "primary" },
        { muscle_id: "lower_back", role: "secondary" },
        { muscle_id: "calves", role: "stabiliser" },
      ],
    });

    expect(fromRead).toBe(fromInput);
  });

  it("should be the same for a name with spaces round it, which core trims", async () => {
    const { fromInput, fromRead } = await fingerprintsOf({
      name: `  ${uniqueName("padded")}  `,
      equipment: "machine",
      muscles: [{ muscle_id: "quads", role: "primary" }],
    });

    expect(fromRead).toBe(fromInput);
  });
});
