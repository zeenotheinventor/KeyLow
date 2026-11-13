import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getExerciseFormMedia } from "../../src/repos/exerciseFormMedia";
import { createTestClient } from "../createTestClient";
import { REST_URL, postgrestError } from "../support/postgrest";

const EXERCISE_ID = "77777777-7777-4777-8777-777777777777";
const SECRET_NAME = "key957-private-exercise-name";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const answerWith = (rows: readonly unknown[]) => {
  server.use(http.post(`${REST_URL}/rpc/exercise_form_media`, () => HttpResponse.json(rows)));
};

const rejectionOf = async (call: Promise<unknown>): Promise<Error | null> => {
  try {
    await call;
  } catch (error) {
    return error instanceof Error ? error : new Error("(not an Error)");
  }
  return null;
};

const photoPaths = ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"];

describe("getExerciseFormMedia", () => {
  it("should ask for the exercise by its id", async () => {
    let body: unknown;
    server.use(
      http.post(`${REST_URL}/rpc/exercise_form_media`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json([]);
      }),
    );

    await getExerciseFormMedia(createTestClient(), EXERCISE_ID);

    expect(body).toEqual({ p_exercise_id: EXERCISE_ID });
  });

  it("should give both the video and the photos of a row that has both", async () => {
    answerWith([
      {
        video_id: "aB3_-xYz012",
        video_title: "Barbell squat form",
        video_channel: "Form Channel",
        image_paths: photoPaths,
      },
    ]);

    await expect(getExerciseFormMedia(createTestClient(), EXERCISE_ID)).resolves.toEqual({
      video: { videoId: "aB3_-xYz012", title: "Barbell squat form", channel: "Form Channel" },
      photos: { imagePaths: ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"] },
    });
  });

  it("should give the photos alone for a row with no video", async () => {
    answerWith([
      { video_id: null, video_title: null, video_channel: null, image_paths: photoPaths },
    ]);

    await expect(getExerciseFormMedia(createTestClient(), EXERCISE_ID)).resolves.toEqual({
      video: null,
      photos: { imagePaths: ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"] },
    });
  });

  it("should give neither for a custom exercise's empty paths", async () => {
    answerWith([{ video_id: null, video_title: null, video_channel: null, image_paths: [] }]);

    await expect(getExerciseFormMedia(createTestClient(), EXERCISE_ID)).resolves.toEqual({
      video: null,
      photos: null,
    });
  });

  it("should give neither when no row comes back, as for an exercise that is not visible", async () => {
    answerWith([]);

    await expect(getExerciseFormMedia(createTestClient(), EXERCISE_ID)).resolves.toEqual({
      video: null,
      photos: null,
    });
  });

  it("should throw an error that names the action and the code only", async () => {
    server.use(
      http.post(`${REST_URL}/rpc/exercise_form_media`, () =>
        postgrestError(500, "XX000", `failed for ${SECRET_NAME}`, { details: SECRET_NAME }),
      ),
    );

    const error = await rejectionOf(getExerciseFormMedia(createTestClient(), EXERCISE_ID));

    expect(error?.message).toBe("Could not load the form media of an exercise (XX000)");
    expect(error?.cause).toEqual({ code: "XX000" });
    expect(JSON.stringify({ message: error?.message, cause: error?.cause })).not.toContain(
      SECRET_NAME,
    );
  });
});
