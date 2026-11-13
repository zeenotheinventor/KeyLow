import { assertEquals, assertFalse, assertStringIncludes } from "@std/assert";

import { assistantExerciseFormMediaSchema } from "../../core.ts";
import { executeTool } from "../executor.ts";
import { createFakeContext } from "../testing.ts";
import { toJsonSchema } from "../tool.ts";
import { dataNotice } from "./shared.ts";
import { showExerciseFormTool } from "./showExerciseForm.ts";
import { payloadOf, stubCaller } from "./testing.ts";
import { exerciseId, exerciseRow } from "./trainingFixtures.ts";

import type { ExecutionResult } from "../executor.ts";
import type { StubData } from "./testing.ts";

const barbellSquat = exerciseRow(1, { name: "Barbell Squat" });

const videoRow = {
  video_id: "dQw4w9WgXcQ",
  video_title: "Sentinel squat tutorial",
  video_channel: "Sentinel Channel",
  image_paths: ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"],
};

const videoOnlyRow = { ...videoRow, image_paths: null };

const photosRow = {
  video_id: null,
  video_title: null,
  video_channel: null,
  image_paths: ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"],
};

const emptyRow = {
  video_id: null,
  video_title: null,
  video_channel: null,
  image_paths: null,
};

const dataOf = (mediaRow: Record<string, unknown> | null, ...rows: Record<string, unknown>[]) =>
  ({
    tables: { exercises: rows },
    rpc: { exercise_form_media: mediaRow === null ? [] : [mediaRow] },
  }) satisfies StubData;

async function showForm(data: StubData, rawInput: unknown) {
  const { caller, calls } = stubCaller(data);
  const { ctx } = createFakeContext([showExerciseFormTool]);
  const result = await executeTool({ ...ctx, caller }, "show_exercise_form", rawInput);
  return { result, calls };
}

const askedFor = (id: string) => ({ exercise_id: id });

const structuredOf = (result: ExecutionResult) =>
  result.status === "ok" ? result.structured : "error";

Deno.test("show_exercise_form is a read tool that says it is read-only and is not strict", () => {
  assertEquals(showExerciseFormTool.kind, "read");
  assertEquals(showExerciseFormTool.annotations, { readOnlyHint: true });
  assertEquals(showExerciseFormTool.strict, false);
});

Deno.test("show_exercise_form does not refuse during a workout, because it writes nothing", () => {
  assertEquals("refusesDuringWorkout" in showExerciseFormTool, false);
});

Deno.test("show_exercise_form takes one exercise id and tells the model what the app does", () => {
  const schema = toJsonSchema(showExerciseFormTool);
  assertEquals(Object.keys(schema["properties"] ?? {}), ["exercise_id"]);
  assertEquals(schema["required"], ["exercise_id"]);
  const { description } = showExerciseFormTool;
  assertStringIncludes(description, "how to do an exercise");
  assertStringIncludes(description, "Call it once per exercise");
  assertStringIncludes(description, "never an invented one");
  assertStringIncludes(description, "draws the card under your reply");
  assertStringIncludes(description, "Never write a link, a URL or a video title.");
  assertStringIncludes(description, "not_found");
  assertStringIncludes(description, dataNotice);
});

Deno.test("show_exercise_form does not model a first person reply", () => {
  assertEquals(/\b(?:I|I'm|I'll|I've|I'd|me|my)\b/.test(showExerciseFormTool.description), false);
});

Deno.test(
  "show_exercise_form tells the model a video is shown, with no title and no channel",
  async () => {
    const { result } = await showForm(dataOf(videoOnlyRow, barbellSquat), askedFor(exerciseId(1)));

    assertEquals(payloadOf(result), { exercise: "Barbell Squat", shown: "video" });
    for (const hidden of [
      exerciseId(1),
      "dQw4w9WgXcQ",
      "Sentinel squat tutorial",
      "Sentinel Channel",
      "title",
      "channel",
      "youtube",
      "http",
    ]) {
      assertFalse(result.text.includes(hidden), hidden);
    }
  },
);

Deno.test(
  "show_exercise_form hands the app the video as an id, a title and a channel",
  async () => {
    const { result } = await showForm(dataOf(videoOnlyRow, barbellSquat), askedFor(exerciseId(1)));

    const structured = structuredOf(result);
    assertEquals(structured, {
      exerciseFormMedia: {
        exerciseName: "Barbell Squat",
        media: {
          kind: "video",
          videoId: "dQw4w9WgXcQ",
          title: "Sentinel squat tutorial",
          channel: "Sentinel Channel",
        },
      },
    });
    // The app's strict schema refuses an extra key, so the value must parse as the event carries it.
    assertEquals(
      assistantExerciseFormMediaSchema.safeParse(
        typeof structured === "object" && structured !== null && "exerciseFormMedia" in structured
          ? structured.exerciseFormMedia
          : null,
      ).success,
      true,
    );
  },
);

Deno.test("show_exercise_form tells the model photos are shown, with no path", async () => {
  const { result } = await showForm(dataOf(photosRow, barbellSquat), askedFor(exerciseId(1)));

  assertEquals(payloadOf(result), { exercise: "Barbell Squat", shown: "photos" });
  assertFalse(result.text.includes("Barbell_Squat"));
  assertEquals(structuredOf(result), {
    exerciseFormMedia: {
      exerciseName: "Barbell Squat",
      media: { kind: "photos", imagePaths: ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"] },
    },
  });
});

Deno.test(
  "show_exercise_form sends the video with both photo paths when the exercise has both",
  async () => {
    const { result } = await showForm(dataOf(videoRow, barbellSquat), askedFor(exerciseId(1)));

    assertEquals(payloadOf(result), { exercise: "Barbell Squat", shown: "video and photos" });
    const structured = structuredOf(result);
    assertEquals(structured, {
      exerciseFormMedia: {
        exerciseName: "Barbell Squat",
        media: {
          kind: "video",
          videoId: "dQw4w9WgXcQ",
          title: "Sentinel squat tutorial",
          channel: "Sentinel Channel",
          imagePaths: ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"],
        },
      },
    });
    assertEquals(
      assistantExerciseFormMediaSchema.safeParse(
        typeof structured === "object" && structured !== null && "exerciseFormMedia" in structured
          ? structured.exerciseFormMedia
          : null,
      ).success,
      true,
    );
  },
);

Deno.test("show_exercise_form puts no path or URL in what the model reads, for both", async () => {
  const { result } = await showForm(dataOf(videoRow, barbellSquat), askedFor(exerciseId(1)));

  for (const hidden of ["Barbell_Squat", ".jpg", "dQw4w9WgXcQ", "Sentinel", "http", "youtube"]) {
    assertFalse(result.text.includes(hidden), hidden);
  }
});

Deno.test("show_exercise_form sends no citation or estimate beside the card", async () => {
  const { result } = await showForm(dataOf(videoOnlyRow, barbellSquat), askedFor(exerciseId(1)));

  const structured = structuredOf(result);
  assertEquals(
    typeof structured === "object" && structured !== null ? Object.keys(structured) : [],
    ["exerciseFormMedia"],
  );
});

Deno.test(
  "show_exercise_form says no form guide is held, with no card, when there is nothing",
  async () => {
    for (const mediaRow of [emptyRow, null]) {
      const { result } = await showForm(dataOf(mediaRow, barbellSquat), askedFor(exerciseId(1)));

      assertEquals(payloadOf(result), {
        exercise: "Barbell Squat",
        shown: "nothing",
        note: "No form guide is held for this exercise.",
      });
      assertEquals(structuredOf(result), null);
    }
  },
);

Deno.test(
  "show_exercise_form answers not_found, with no card and no media read, when the caller cannot see the exercise",
  async () => {
    // Another person's custom exercise, an archived one and one that does not exist look the same: no row.
    const { result, calls } = await showForm(
      dataOf(videoRow, barbellSquat),
      askedFor(exerciseId(2)),
    );

    assertEquals(payloadOf(result), { error: "not_found" });
    assertEquals(structuredOf(result), null);
    assertEquals(
      calls.some((call) => call.method.startsWith("rpc:")),
      false,
    );
  },
);

Deno.test(
  "show_exercise_form reads the exercise and its media through the caller's own client",
  async () => {
    const { calls } = await showForm(dataOf(videoRow, barbellSquat), askedFor(exerciseId(1)));

    assertEquals([...new Set(calls.map((call) => call.table))], ["exercises", null]);
    assertEquals(
      calls.filter((call) => call.method.startsWith("rpc:")).map((call) => call.method),
      ["rpc:exercise_form_media"],
    );
  },
);

Deno.test("show_exercise_form rejects input it does not accept, before any read", async () => {
  const badInputs = [
    { exercise_id: "barbell-squat" },
    {},
    { exercise_id: exerciseId(1), side: "back" },
    { exercise_ids: [exerciseId(1)] },
    null,
    [],
    "barbell squat",
  ];

  for (const input of badInputs) {
    const { result, calls } = await showForm(dataOf(videoRow, barbellSquat), input);
    assertEquals(
      result.status === "error" ? result.code : null,
      "invalid_input",
      JSON.stringify(input),
    );
    assertEquals(calls, []);
  }
});
