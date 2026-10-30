import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient } from "./support/stack";
import { saveExercise as saveCustomExercise } from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { archiveExercise, saveExercise } from "../../src/repos/exerciseWrites";
import { listSuggestionLibrary } from "../../src/repos/suggestionLibrary";

import type { TestUser } from "./support/users";
import type { CustomExerciseDraft } from "@keylow/core/training";

// The suggestion library against the local stack with real user JWTs. Every test signs in its own users, so
// what another test left on the stack cannot change a result, and no test picks an exercise of the library
// by its place in the id order: the library is compared as a set. Every exercise written here is named
// key405- plus a random suffix, and the users' exercises go with them (on delete cascade).

afterAll(async () => {
  await deleteCreatedTestUsers();
});

const uniqueName = (label: string) => `key405-${label}-${crypto.randomUUID()}`;

const draftOf = (
  name: string,
  equipment: CustomExerciseDraft["equipment"],
): CustomExerciseDraft => ({
  name,
  equipment,
  muscles: [
    { muscle_id: "delt_side", role: "primary" },
    { muscle_id: "traps_upper", role: "secondary" },
  ],
});

/** The ids of the live library exercises of this equipment, as the service role sees them. */
async function liveLibraryIds(equipment: "dumbbell" | "barbell"): Promise<string[]> {
  const { data, error } = await adminClient()
    .from("exercises")
    .select("id")
    .eq("source", "free_exercise_db")
    .eq("equipment", equipment)
    .is("deleted_at", null)
    .not("source_ref", "like", "key349-%");
  if (error) {
    throw new Error(`Could not read the library (${error.code})`);
  }
  return data.map(({ id }) => id);
}

describe("listSuggestionLibrary over the real tables", () => {
  let owner: TestUser;
  let stranger: TestUser;
  let ownDumbbellId: string;
  let ownCableId: string;
  let strangerDumbbellId: string;
  let archivedDumbbellId: string;

  beforeAll(async () => {
    [owner, stranger] = await Promise.all([createTestUser("key405"), createTestUser("key405")]);
    ownDumbbellId = (
      await saveExercise(owner.client, { draft: draftOf(uniqueName("own"), "dumbbell") })
    ).id;
    ownCableId = (
      await saveExercise(owner.client, { draft: draftOf(uniqueName("cable"), "cable") })
    ).id;
    strangerDumbbellId = (
      await saveExercise(stranger.client, { draft: draftOf(uniqueName("stranger"), "dumbbell") })
    ).id;
    archivedDumbbellId = (
      await saveExercise(owner.client, { draft: draftOf(uniqueName("archived"), "dumbbell") })
    ).id;
    await archiveExercise(owner.client, archivedDumbbellId);
  });

  it("should give the caller's own exercise with its full muscle map, beside the library", async () => {
    const library = await listSuggestionLibrary(owner.client, { equipment: ["dumbbell"] });

    const own = library.find((exercise) => exercise.id === ownDumbbellId);
    expect(own).toMatchObject({ equipment: "dumbbell", mechanic: "isolation" });
    expect(own?.muscles.map(({ muscle_id, role }) => `${muscle_id}:${role}`).sort()).toEqual([
      "delt_side:primary",
      "traps_upper:secondary",
    ]);
    const libraryIds = new Set(library.map(({ id }) => id));
    for (const id of await liveLibraryIds("dumbbell")) {
      expect(libraryIds.has(id)).toBe(true);
    }
  });

  it("should give an exercise of every piece of equipment asked for and of no other", async () => {
    const library = await listSuggestionLibrary(owner.client, { equipment: ["dumbbell", "cable"] });

    expect(new Set(library.map(({ equipment }) => equipment))).toEqual(
      new Set(["dumbbell", "cable"]),
    );
    const ids = new Set(library.map(({ id }) => id));
    expect(ids.has(ownDumbbellId)).toBe(true);
    expect(ids.has(ownCableId)).toBe(true);
  });

  it("should never give a barbell exercise to a user with dumbbells only", async () => {
    const library = await listSuggestionLibrary(owner.client, { equipment: ["dumbbell"] });

    expect(library.length).toBeGreaterThan(0);
    expect(library.every(({ equipment }) => equipment === "dumbbell")).toBe(true);
    const libraryIds = new Set(library.map(({ id }) => id));
    for (const id of await liveLibraryIds("barbell")) {
      expect(libraryIds.has(id)).toBe(false);
    }
    expect(libraryIds.has(ownCableId)).toBe(false);
  });

  it("should never show another user's custom exercise", async () => {
    const ownerSees = await listSuggestionLibrary(owner.client, {
      equipment: ["dumbbell", "cable"],
    });
    const strangerSees = await listSuggestionLibrary(stranger.client, {
      equipment: ["dumbbell", "cable"],
    });

    expect(ownerSees.map(({ id }) => id)).not.toContain(strangerDumbbellId);
    expect(strangerSees.map(({ id }) => id)).toContain(strangerDumbbellId);
    expect(strangerSees.map(({ id }) => id)).not.toContain(ownDumbbellId);
    expect(strangerSees.map(({ id }) => id)).not.toContain(ownCableId);
  });

  it("should leave out an archived exercise", async () => {
    const library = await listSuggestionLibrary(owner.client, { equipment: ["dumbbell"] });

    expect(library.map(({ id }) => id)).not.toContain(archivedDumbbellId);
  });

  it("should give nothing, and ask for nothing, when no equipment is asked for", async () => {
    expect(await listSuggestionLibrary(owner.client, { equipment: [] })).toEqual([]);
  });

  describe("a user with more exercises than one page holds", () => {
    const FULL_GYM = [
      "barbell",
      "dumbbell",
      "kettlebell",
      "cable",
      "machine",
      "smith_machine",
      "ez_bar",
      "band",
      "bodyweight",
    ] as const;
    const SAVE_BATCH = 20;

    it("should give every exercise across the pages, in id order, once each", async () => {
      // Saving an exercise needs its muscle map in the same transaction, so the rows go in through
      // `save_exercise`. Enough of the user's own are saved to push the total past one page of 1,000.
      const { count, error } = await adminClient()
        .from("exercises")
        .select("id", { count: "exact", head: true })
        .eq("source", "free_exercise_db")
        .is("deleted_at", null)
        .in("equipment", [...FULL_GYM]);
      if (error) {
        throw new Error(`Could not count the library (${error.code})`);
      }
      const heavy = await createTestUser("key405");
      const ownCount = Math.max(50, 1050 - (count ?? 0));
      const ownIds: string[] = [];
      for (let saved = 0; saved < ownCount; saved += SAVE_BATCH) {
        const batch = await Promise.all(
          Array.from({ length: Math.min(SAVE_BATCH, ownCount - saved) }, () =>
            saveCustomExercise(heavy, "key405-bulk"),
          ),
        );
        ownIds.push(...batch.map(({ id }) => id));
      }

      const library = await listSuggestionLibrary(heavy.client, { equipment: [...FULL_GYM] });

      const ids = library.map(({ id }) => id);
      expect(ids.length).toBeGreaterThan(1000);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toEqual([...ids].sort());
      const listed = new Set(ids);
      expect(ownIds.every((id) => listed.has(id))).toBe(true);
      for (const id of [
        ...(await liveLibraryIds("dumbbell")),
        ...(await liveLibraryIds("barbell")),
      ]) {
        expect(listed.has(id)).toBe(true);
      }
    }, 90_000);
  });
});
