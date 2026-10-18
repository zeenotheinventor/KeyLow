import { buildSetSnapshot } from "@keylow/core/training";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { present } from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { ExerciseRuleError } from "../../src/errors";
import { getExercise, searchExercises } from "../../src/repos/exercises";
import { archiveExercise, saveExercise } from "../../src/repos/exerciseWrites";
import { startSession } from "../../src/repos/sessionWrites";
import { addSet } from "../../src/repos/setWrites";

import type { TestUser } from "./support/users";
import type { CustomExerciseDraft } from "@keylow/core/training";

// The exercise search, read and writes against the local stack with real user JWTs. Every test signs in
// its own users, so what another test left on the stack cannot change a result. Every exercise is named
// key389- plus a random suffix, and the users' exercises go with them (on delete cascade).

afterAll(async () => {
  await deleteCreatedTestUsers();
});

const NOW = new Date("2026-10-18T09:30:00Z");

const rejectionOf = async (call: Promise<unknown>): Promise<Error | null> => {
  try {
    await call;
  } catch (error) {
    return error instanceof Error ? error : new Error("(not an Error)");
  }
  return null;
};

const uniqueName = (label: string) => `key389-${label}-${crypto.randomUUID()}`;

const draftOf = (
  name: string,
  overrides: Partial<CustomExerciseDraft> = {},
): CustomExerciseDraft => ({
  name,
  equipment: "cable",
  muscles: [
    { muscle_id: "delt_side", role: "primary" },
    { muscle_id: "traps_upper", role: "secondary" },
  ],
  ...overrides,
});

let globalExerciseId: string;

beforeAll(async () => {
  const [hit] = await searchExercises((await createTestUser("key389")).client, "press", {
    limit: 50,
  });
  globalExerciseId = present(hit, "a library exercise containing press").id;
});

/** The stored snapshot of a set, as its owner reads it. */
async function storedSnapshot(user: TestUser, setId: string) {
  const { data, error } = await user.client
    .from("workout_sets")
    .select("snapshot")
    .eq("id", setId)
    .single();
  if (error) {
    throw new Error(`Could not read the test set (${error.code})`);
  }
  return data.snapshot;
}

const newSet = (user: TestUser, sessionId: string, exerciseId: string) =>
  addSet(user.client, {
    sessionId,
    exerciseId,
    draft: { setType: "working", load: "20", reps: "12", rir: "2", rpe: "" },
    unit: "kg",
    effortMode: "rir",
    now: NOW,
  });

describe("saveExercise", () => {
  it("should create the canvas example with the weights 1 and 0.5 and the derived isolation mechanic", async () => {
    const owner = await createTestUser("key389");
    const name = uniqueName("lean-away-cable-raise");

    const saved = await saveExercise(owner.client, { draft: draftOf(name) });

    expect(saved).toMatchObject({
      name,
      equipment: "cable",
      mechanic: "isolation",
      source: "user",
    });
    expect(saved.muscles).toEqual([
      { muscle_id: "delt_side", role: "primary", weight: 1 },
      { muscle_id: "traps_upper", role: "secondary", weight: 0.5 },
    ]);
  });

  it("should store the weight 0.2 for an assisting muscle and derive compound from two primaries", async () => {
    const owner = await createTestUser("key389");

    const saved = await saveExercise(owner.client, {
      draft: draftOf(uniqueName("squat"), {
        equipment: "barbell",
        muscles: [
          { muscle_id: "quads", role: "primary" },
          { muscle_id: "glute_max", role: "primary" },
          { muscle_id: "forearms", role: "stabiliser" },
        ],
      }),
    });

    expect(saved.mechanic).toBe("compound");
    expect(saved.muscles.find(({ muscle_id }) => muscle_id === "forearms")?.weight).toBe(0.2);
  });

  it("should replace the muscle map as a whole when an exercise is edited", async () => {
    const owner = await createTestUser("key389");
    const created = await saveExercise(owner.client, { draft: draftOf(uniqueName("edit")) });

    const edited = await saveExercise(owner.client, {
      id: created.id,
      draft: draftOf(created.name, { muscles: [{ muscle_id: "biceps", role: "primary" }] }),
    });

    expect(edited.id).toBe(created.id);
    expect(edited.muscles).toEqual([{ muscle_id: "biceps", role: "primary", weight: 1 }]);
  });

  it("should refuse an exercise with no primary muscle before any request, so nothing is stored", async () => {
    const owner = await createTestUser("key389");
    const name = uniqueName("no-primary");

    const refused = await rejectionOf(
      saveExercise(owner.client, {
        draft: draftOf(name, { muscles: [{ muscle_id: "delt_side", role: "secondary" }] }),
      }),
    );

    expect(refused).toBeInstanceOf(RangeError);
    expect(refused?.message).toBe("The exercise is not valid at muscles (primary_missing)");
    expect(await searchExercises(owner.client, name)).toEqual([]);
  });

  it("should refuse to edit a global exercise with the typed rule and not a database message", async () => {
    const owner = await createTestUser("key389");
    const globalId = globalExerciseId;

    const refused = await rejectionOf(
      saveExercise(owner.client, { id: globalId, draft: draftOf(uniqueName("hijack")) }),
    );

    expect(refused).toBeInstanceOf(ExerciseRuleError);
    expect(refused).toMatchObject({ rule: "global_exercise" });
    expect(refused?.message).toBe("Could not save the exercise (global_exercise)");
  });

  it("should fail with P0002 for another user's exercise, the same as for one that does not exist", async () => {
    const owner = await createTestUser("key389");
    const stranger = await createTestUser("key389");
    const theirs = await saveExercise(owner.client, { draft: draftOf(uniqueName("private")) });

    const foreign = await rejectionOf(
      saveExercise(stranger.client, { id: theirs.id, draft: draftOf(uniqueName("steal")) }),
    );
    const missing = await rejectionOf(
      saveExercise(stranger.client, {
        id: "00000000-0000-4000-8000-000000000000",
        draft: draftOf(uniqueName("missing")),
      }),
    );

    expect(foreign).not.toBeInstanceOf(ExerciseRuleError);
    expect(foreign?.message).toBe("Could not save the exercise (P0002)");
    expect(missing?.message).toBe(foreign?.message);
  });
});

describe("searchExercises", () => {
  it("should find the library by name and give each exercise its primary and secondary muscles", async () => {
    const owner = await createTestUser("key389");

    const hits = await searchExercises(owner.client, "press", { limit: 50 });

    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.name.toLowerCase()).toContain("press");
      expect(hit.source).toBe("free_exercise_db");
      expect(hit.primary_muscles.length).toBeGreaterThan(0);
    }
  });

  it("should sort the caller's own exercise before the library rows, though its name sorts after them", async () => {
    const owner = await createTestUser("key389");
    const name = `Zzz key389 lean-away cable raise ${crypto.randomUUID()}`;
    const own = await saveExercise(owner.client, { draft: draftOf(name) });

    const hits = await searchExercises(owner.client, "raise", { limit: 50 });

    expect(hits[0]).toMatchObject({
      id: own.id,
      source: "user",
      primary_muscles: ["delt_side"],
      secondary_muscles: ["traps_upper"],
    });
    expect(hits.slice(1).every(({ source }) => source === "free_exercise_db")).toBe(true);
    expect(hits.length).toBeGreaterThan(1);
  });

  it("should match a percent sign and an underscore literally", async () => {
    const owner = await createTestUser("key389");
    const token = crypto.randomUUID();
    const literal = await saveExercise(owner.client, {
      draft: draftOf(`key389-100%_pure-${token}`),
    });
    await saveExercise(owner.client, { draft: draftOf(`key389-100xxpure-${token}`) });

    const hits = await searchExercises(owner.client, `100%_pure-${token}`);

    expect(hits.map(({ id }) => id)).toEqual([literal.id]);
  });

  it("should never show another user's custom exercise", async () => {
    const owner = await createTestUser("key389");
    const stranger = await createTestUser("key389");
    const name = uniqueName("only-mine");
    const own = await saveExercise(owner.client, { draft: draftOf(name) });

    expect((await searchExercises(owner.client, name)).map(({ id }) => id)).toEqual([own.id]);
    expect(await searchExercises(stranger.client, name)).toEqual([]);
    expect(await getExercise(stranger.client, own.id)).toBeNull();
  });

  it("should never show an archived custom exercise, in search or on its own read", async () => {
    const owner = await createTestUser("key389");
    const name = uniqueName("archived");
    const own = await saveExercise(owner.client, { draft: draftOf(name) });

    await archiveExercise(owner.client, own.id);

    expect(await searchExercises(owner.client, name)).toEqual([]);
    expect(await getExercise(owner.client, own.id)).toBeNull();
  });
});

describe("getExercise", () => {
  it("should read the full muscle map of a library exercise, with a primary muscle", async () => {
    const owner = await createTestUser("key389");
    const globalId = globalExerciseId;

    const exercise = await getExercise(owner.client, globalId);

    expect(exercise?.source).toBe("free_exercise_db");
    expect(exercise?.muscles.some(({ role }) => role === "primary")).toBe(true);
  });
});

describe("archiveExercise", () => {
  it("should refuse a global exercise with the typed rule", async () => {
    const owner = await createTestUser("key389");
    const globalId = globalExerciseId;

    const refused = await rejectionOf(archiveExercise(owner.client, globalId));

    expect(refused).toBeInstanceOf(ExerciseRuleError);
    expect(await getExercise(owner.client, globalId)).not.toBeNull();
  });

  it("should keep the sets already logged of an archived exercise", async () => {
    const owner = await createTestUser("key389");
    const session = await startSession(owner.client, { now: NOW, tz: "UTC" });
    const own = await saveExercise(owner.client, { draft: draftOf(uniqueName("kept")) });
    const set = await newSet(owner, session.id, own.id);

    await archiveExercise(owner.client, own.id);

    expect(await storedSnapshot(owner, set.id)).toMatchObject({ ref: own.id });
  });
});

describe("the snapshot of a logged set when its exercise is edited", () => {
  it("should leave an existing set's snapshot byte for byte unchanged, and give a new set the new map", async () => {
    const owner = await createTestUser("key389");
    const session = await startSession(owner.client, { now: NOW, tz: "UTC" });
    const created = await saveExercise(owner.client, { draft: draftOf(uniqueName("snapshot")) });
    const first = await newSet(owner, session.id, created.id);
    const before = await storedSnapshot(owner, first.id);

    const edited = await saveExercise(owner.client, {
      id: created.id,
      draft: draftOf(created.name, {
        muscles: [
          { muscle_id: "delt_rear", role: "primary" },
          { muscle_id: "lats", role: "secondary" },
        ],
      }),
    });
    const after = await storedSnapshot(owner, first.id);
    const second = await newSet(owner, session.id, created.id);

    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    expect(before).toEqual(
      buildSetSnapshot(
        { id: created.id, name: created.name, equipment: "cable", mechanic: "isolation" },
        created.muscles,
      ),
    );
    expect(await storedSnapshot(owner, second.id)).toEqual(
      buildSetSnapshot(
        { id: created.id, name: created.name, equipment: "cable", mechanic: "isolation" },
        edited.muscles,
      ),
    );
    expect(JSON.stringify(await storedSnapshot(owner, second.id))).not.toBe(JSON.stringify(before));
  });
});
