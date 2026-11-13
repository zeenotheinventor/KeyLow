import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getExerciseFormMedia } from "../../../../api-client/src/repos/exerciseFormMedia";
import { getExercise } from "../../../../api-client/src/repos/exercises";
import { saveExercise } from "../../../../api-client/test/integration/support/training";
import { formMediaToShow } from "../../../../core/src/training";
import { adminClient } from "../support/stack";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

import type { SavedExercise } from "../../../../api-client/test/integration/support/training";
import type { TestUser } from "../support/users";

/*
 * The two reads behind `show_exercise_form` against the real tables, with two users. HTTP-free, like the
 * other training tools' files: each read runs with the user's own signed-in client, which is the client the
 * `mcp` function hands a tool as its caller, so row level security scopes it. It proves the tool's answers:
 * another person's custom exercise reads as nothing at the first read (so `not_found`, and the media is never
 * asked for), an own custom exercise has no video and no photos (so no card), a library exercise with a
 * curated video answers that video, and a library exercise without one answers its photos. The tool's own
 * tests run under Deno with a stub client and assert the words and the card. Each user's exercise has a name of
 * its own, and nothing here resets the stack.
 */

const SEEDED_VIDEO_SOURCE_REF = "Barbell_Squat";
const SEEDED_VIDEO_ID = "i7J5h7BJ07g";

let alice: TestUser;
let bob: TestUser;
let aliceExercise: SavedExercise;
let seededExerciseId: string;
let photosExerciseId: string;

async function libraryExerciseIdBySourceRef(sourceRef: string): Promise<string> {
  const { data, error } = await adminClient()
    .from("exercises")
    .select("id")
    .eq("source", "free_exercise_db")
    .eq("source_ref", sourceRef)
    .is("owner_id", null)
    .is("deleted_at", null)
    .single();
  if (error) {
    throw new Error(`Could not read a library exercise (${error.code})`);
  }
  return data.id;
}

// A library exercise the video seed does not cover, which answers its photos. Only about a tenth of the
// library has a video, so the first fifty live exercises hold one.
async function libraryExerciseIdWithPhotos(user: TestUser): Promise<string> {
  const { data, error } = await adminClient()
    .from("exercises")
    .select("id")
    .eq("source", "free_exercise_db")
    .is("owner_id", null)
    .is("deleted_at", null)
    .order("id")
    .limit(50);
  if (error) {
    throw new Error(`Could not read library exercises (${error.code})`);
  }
  for (const { id } of data) {
    if (formMediaToShow(await getExerciseFormMedia(user.client, id), "video").kind === "photos") {
      return id;
    }
  }
  throw new Error("No library exercise with photos and no video was found");
}

beforeAll(async () => {
  [alice, bob] = await Promise.all([createTestUser("key963-alice"), createTestUser("key963-bob")]);
  [aliceExercise, seededExerciseId] = await Promise.all([
    saveExercise(alice, "form-own"),
    libraryExerciseIdBySourceRef(SEEDED_VIDEO_SOURCE_REF),
  ]);
  photosExerciseId = await libraryExerciseIdWithPhotos(alice);
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe("show_exercise_form", () => {
  it("reads another user's custom exercise as nothing, so the media is never asked for", async () => {
    const missingExerciseId = "00000000-0000-4000-8000-000000000000";

    expect(await getExercise(bob.client, aliceExercise.id)).toBeNull();
    expect(await getExercise(alice.client, missingExerciseId)).toBeNull();
  });

  it("reads the caller's own custom exercise, which holds no video and no photos", async () => {
    expect((await getExercise(alice.client, aliceExercise.id))?.name).toBe(aliceExercise.name);
    expect(
      formMediaToShow(await getExerciseFormMedia(alice.client, aliceExercise.id), "video"),
    ).toEqual({ kind: "none" });
  });

  it("reads the curated video of a library exercise, for either user", async () => {
    for (const user of [alice, bob]) {
      const media = formMediaToShow(
        await getExerciseFormMedia(user.client, seededExerciseId),
        "video",
      );

      expect(media.kind).toBe("video");
      expect(media.kind === "video" ? media.videoId : null).toBe(SEEDED_VIDEO_ID);
    }
  });

  it("reads the start and end photos of a library exercise that has no video", async () => {
    const media = formMediaToShow(
      await getExerciseFormMedia(bob.client, photosExerciseId),
      "video",
    );

    expect(media.kind).toBe("photos");
    expect(media.kind === "photos" ? media.imagePaths : []).toHaveLength(2);
  });
});
