import { describe, expect, it } from "vitest";

import {
  firstTurnId,
  replyMessage,
  secondTurnId,
  toolResultMessage,
  toolUseMessage,
  userMessage,
} from "./storedConversations";
import { routineId } from "./trainingCardFixtures";
import {
  assistantExerciseFormMediaSchema,
  assistantStreamEventSchema,
  buildAssistantSheetThread,
  isSentTurnStored,
  parseAssistantEvent,
  threadFromMessages,
} from "../../src/assistant";

import type {
  AssistantCardLink,
  AssistantExerciseFormMedia,
  AssistantSheetLiveTurn,
  AssistantThreadItem,
} from "../../src/assistant";

const squatVideo: AssistantExerciseFormMedia = {
  exerciseName: "Barbell Squat",
  media: {
    kind: "video",
    videoId: "abcdefghijk",
    title: "How to squat with good form",
    channel: "Strength Basics",
  },
};

const curlPhotos: AssistantExerciseFormMedia = {
  exerciseName: "Dumbbell Curl",
  media: { kind: "photos", imagePaths: ["Dumbbell_Curl/0.jpg", "Dumbbell_Curl/1.jpg"] },
};

const link: AssistantCardLink = {
  label: "Open in routine editor",
  target: { screen: "routine_editor", routineId },
};

describe("the exercise_form_media event", () => {
  it("should parse a video", () => {
    const event = { type: "exercise_form_media", exercise: squatVideo };

    expect(assistantStreamEventSchema.parse(event)).toEqual(event);
  });

  it("should parse two photos", () => {
    const event = { type: "exercise_form_media", exercise: curlPhotos };

    expect(assistantStreamEventSchema.parse(event)).toEqual(event);
  });

  it("should parse a video that also carries the two photo paths", () => {
    const event = {
      type: "exercise_form_media",
      exercise: {
        ...squatVideo,
        media: { ...squatVideo.media, imagePaths: ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"] },
      },
    };

    expect(assistantStreamEventSchema.parse(event)).toEqual(event);
  });

  describe("refuses", () => {
    const withMedia = (media: unknown) => ({ ...squatVideo, media });
    const refused = (value: unknown) => assistantExerciseFormMediaSchema.safeParse(value).success;

    it("should refuse a URL in place of a video id", () => {
      expect(
        refused(withMedia({ ...squatVideo.media, videoId: "https://youtu.be/abcdefghijk" })),
      ).toBe(false);
    });

    it("should refuse a video id of 10 characters and of 12", () => {
      expect(refused(withMedia({ ...squatVideo.media, videoId: "abcdefghij" }))).toBe(false);
      expect(refused(withMedia({ ...squatVideo.media, videoId: "abcdefghijkl" }))).toBe(false);
    });

    it("should refuse an unknown key on the card, the video and the photos", () => {
      expect(refused({ ...squatVideo, url: "https://example.com" })).toBe(false);
      expect(refused(withMedia({ ...squatVideo.media, watchUrl: "https://example.com" }))).toBe(
        false,
      );
      expect(
        refused({ ...curlPhotos, media: { ...curlPhotos.media, startUrl: "https://example.com" } }),
      ).toBe(false);
    });

    it("should refuse one image path", () => {
      expect(
        refused({ ...curlPhotos, media: { kind: "photos", imagePaths: ["Dumbbell_Curl/0.jpg"] } }),
      ).toBe(false);
    });

    it("should refuse a path outside the free-exercise-db shape", () => {
      const photos = (imagePaths: string[]) => ({
        ...curlPhotos,
        media: { kind: "photos", imagePaths },
      });

      expect(refused(photos(["https://example.com/a.jpg", "Dumbbell_Curl/1.jpg"]))).toBe(false);
      expect(refused(photos(["../secret/0.jpg", "Dumbbell_Curl/1.jpg"]))).toBe(false);
      expect(refused(photos(["Dumbbell_Curl/0.png", "Dumbbell_Curl/1.jpg"]))).toBe(false);
    });

    it("should refuse a URL or one path in the photo paths of a video", () => {
      const withPaths = (imagePaths: string[]) => withMedia({ ...squatVideo.media, imagePaths });

      expect(refused(withPaths(["https://example.com/a.jpg", "Barbell_Squat/1.jpg"]))).toBe(false);
      expect(refused(withPaths(["Barbell_Squat/0.jpg"]))).toBe(false);
    });

    it("should refuse an empty exercise name", () => {
      expect(refused({ ...squatVideo, exerciseName: "" })).toBe(false);
    });

    it("should refuse a name of more than 200 characters", () => {
      expect(refused({ ...squatVideo, exerciseName: "x".repeat(201) })).toBe(false);
    });

    it("should refuse media of kind none, which is never sent", () => {
      expect(refused(withMedia({ kind: "none" }))).toBe(false);
    });

    it("should refuse an event without its exercise", () => {
      expect(assistantStreamEventSchema.safeParse({ type: "exercise_form_media" }).success).toBe(
        false,
      );
    });
  });

  it("should be read by parseAssistantEvent, and name a bad field by its path without its value", () => {
    const good = parseAssistantEvent(
      JSON.stringify({ type: "exercise_form_media", exercise: curlPhotos }),
    );
    const bad = parseAssistantEvent(
      JSON.stringify({
        type: "exercise_form_media",
        exercise: { ...squatVideo, media: { ...squatVideo.media, videoId: "short" } },
      }),
    );

    expect(good).toEqual({
      ok: true,
      event: { type: "exercise_form_media", exercise: curlPhotos },
    });
    expect(bad).toEqual({
      ok: false,
      reason: "invalid_event",
      fieldPaths: ["exercise.media.videoId"],
    });
  });
});

const storedTurn = (
  results: { toolUseId: string; outcome: unknown }[],
  words?: string,
  turnId: string = firstTurnId,
  ids = ["m1", "m2", "m3", "m4"],
) => [
  userMessage(ids[0] ?? "m1", turnId, "How do I do these?"),
  toolUseMessage(
    ids[1] ?? "m2",
    turnId,
    results.map((result) => ({ id: result.toolUseId, name: "show_exercise_form" })),
  ),
  toolResultMessage(
    ids[2] ?? "m3",
    turnId,
    results.map((result) => ({ ...result, source: "show_exercise_form" })),
  ),
  ...(words === undefined ? [] : [replyMessage(ids[3] ?? "m4", turnId, words)]),
];

describe("threadFromMessages, the form media of an exercise", () => {
  const two = [
    { toolUseId: "call-1", outcome: { exerciseFormMedia: squatVideo } },
    { toolUseId: "call-2", outcome: { exerciseFormMedia: curlPhotos } },
  ];

  it("should read two entries back as two items, in call order, after the reply", () => {
    const thread = threadFromMessages(storedTurn(two, "Here are both."), []);

    expect(thread.map((item) => item.kind)).toEqual([
      "user",
      "reply",
      "exercise_form_media",
      "exercise_form_media",
    ]);
    expect(thread[2]).toEqual({
      kind: "exercise_form_media",
      id: "m3:0:exerciseFormMedia",
      exercise: squatVideo,
    });
    expect(thread[3]).toMatchObject({ id: "m3:1:exerciseFormMedia", exercise: curlPhotos });
  });

  it("should drop an entry that does not parse, and only that entry", () => {
    const thread = threadFromMessages(
      storedTurn([
        {
          toolUseId: "call-1",
          outcome: { exerciseFormMedia: { ...squatVideo, media: { kind: "none" } } },
        },
        { toolUseId: "call-2", outcome: { exerciseFormMedia: curlPhotos } },
      ]),
      [],
    );

    expect(thread.filter((item) => item.kind === "exercise_form_media")).toEqual([
      { kind: "exercise_form_media", id: "m3:1:exerciseFormMedia", exercise: curlPhotos },
    ]);
  });

  it("should read an older app's row without the key as a turn with no card", () => {
    const thread = threadFromMessages(
      storedTurn([{ toolUseId: "call-1", outcome: {} }], "Hm."),
      [],
    );

    expect(thread.map((item) => item.kind)).toEqual(["user", "reply"]);
  });

  it("should keep the order reply, form media, link, Ask again", () => {
    const thread = threadFromMessages(
      storedTurn(
        [
          {
            toolUseId: "call-1",
            outcome: { exerciseFormMedia: curlPhotos, link, askAgain: true },
          },
        ],
        "Words.",
      ),
      [],
    );

    expect(thread.map((item) => item.kind)).toEqual([
      "user",
      "reply",
      "exercise_form_media",
      "link",
      "ask_again",
    ]);
  });

  it("should place it after the muscles of the same turn", () => {
    const thread = threadFromMessages(
      storedTurn(
        [
          {
            toolUseId: "call-1",
            outcome: {
              exerciseFormMedia: curlPhotos,
              exerciseMuscles: {
                exerciseName: "Dumbbell Curl",
                muscles: [{ muscle_id: "biceps", role: "primary" }],
              },
            },
          },
        ],
        "Words.",
      ),
      [],
    );

    expect(thread.map((item) => item.kind)).toEqual([
      "user",
      "reply",
      "exercise_muscles",
      "exercise_form_media",
    ]);
  });
});

const liveTurn = (overrides: Partial<AssistantSheetLiveTurn> = {}): AssistantSheetLiveTurn => ({
  text: "",
  cards: [],
  clarify: null,
  confirm: null,
  answerMeta: null,
  status: null,
  stopped: false,
  notice: null,
  outcome: null,
  ...overrides,
});

const build = (input: Partial<Parameters<typeof buildAssistantSheetThread>[0]> = {}) =>
  buildAssistantSheetThread({ items: [], sent: null, live: null, isStreaming: false, ...input });

const storedItem = (id: string, exercise: AssistantExerciseFormMedia) =>
  ({ kind: "exercise_form_media", id, exercise }) satisfies AssistantThreadItem;

describe("buildAssistantSheetThread, the form media of an exercise", () => {
  it("should draw a stored one as an entry of its own, with the same object", () => {
    const entry = build({ items: [storedItem("f1", squatVideo)] }).entries[0];

    expect(entry).toEqual({ kind: "exerciseFormMedia", key: "f1", exercise: squatVideo });
    expect(entry?.kind === "exerciseFormMedia" && entry.exercise).toBe(squatVideo);
  });

  it("should draw the reply of the turn on screen, then its cards, keyed by position", () => {
    const sent = { text: "How do I do these?", afterItemId: null };
    const live = liveTurn({
      text: "Here are both.",
      exerciseFormMedia: [squatVideo, curlPhotos],
      outcome: "complete",
    });

    const entries = build({ sent, live }).entries;

    expect(entries.map((entry) => entry.key)).toEqual([
      "sent:you",
      "sent:reply",
      "sent:exerciseFormMedia:0",
      "sent:exerciseFormMedia:1",
    ]);
  });

  it("should draw them before the link, the notice and Ask again", () => {
    const sent = { text: "How do I do these?", afterItemId: null };
    const live = liveTurn({
      text: "Words.",
      exerciseFormMedia: [curlPhotos],
      link,
      notice: { code: "turn_failed" },
      askAgain: true,
      outcome: "failed",
    });

    expect(build({ sent, live }).entries.map((entry) => entry.kind)).toEqual([
      "you",
      "assistant",
      "exerciseFormMedia",
      "link",
      "notice",
      "askAgain",
    ]);
  });

  describe("needsFullHeight", () => {
    it("should be true with one in the thread and false with none", () => {
      expect(build({ items: [storedItem("f1", squatVideo)] }).needsFullHeight).toBe(true);
      expect(build().needsFullHeight).toBe(false);
    });

    it("should be true for one in the turn on screen", () => {
      const sent = { text: "Hello", afterItemId: null };

      expect(
        build({ sent, live: liveTurn({ exerciseFormMedia: [squatVideo] }) }).needsFullHeight,
      ).toBe(true);
    });
  });

  describe("canAskAgain", () => {
    const stoppedReply: AssistantThreadItem = {
      kind: "reply",
      id: "r1",
      text: "Partly",
      answerMeta: null,
      stopped: true,
    };

    it("should be true for a stopped reply with a stored card under it", () => {
      const items: AssistantThreadItem[] = [
        { kind: "user", id: "u1", text: "Hello" },
        stoppedReply,
        storedItem("f1", squatVideo),
      ];

      expect(build({ items }).canAskAgain).toBe(true);
    });

    it("should be true for a stopped reply with a card of the turn on screen under it", () => {
      const sent = { text: "Hello", afterItemId: null };
      const live = liveTurn({ text: "Partly", stopped: true, exerciseFormMedia: [curlPhotos] });

      expect(build({ sent, live }).canAskAgain).toBe(true);
    });

    it("should be false for a card with no reply before it", () => {
      expect(build({ items: [storedItem("f1", squatVideo)] }).canAskAgain).toBe(false);
    });
  });
});

describe("isSentTurnStored, the form media of an exercise", () => {
  const items: AssistantThreadItem[] = [
    { kind: "user", id: "u1", text: "Hello" },
    storedItem("f1", squatVideo),
  ];

  it("should count a stored one as the end of a turn with no words", () => {
    expect(isSentTurnStored(items, "u1", { text: "" })).toBe(true);
  });

  it("should not count it while the reply is still to come", () => {
    expect(isSentTurnStored(items, "u1", { text: "Words to come" })).toBe(false);
  });
});

describe("a later turn after a card", () => {
  it("should leave the first turn's card in place", () => {
    const thread = threadFromMessages(
      [
        ...storedTurn([{ toolUseId: "call-1", outcome: { exerciseFormMedia: squatVideo } }], "A."),
        ...storedTurn([], "B.", secondTurnId, ["m5", "m6", "m7", "m8"]),
      ],
      [],
    );

    expect(thread.filter((item) => item.kind === "exercise_form_media")).toHaveLength(1);
  });
});
