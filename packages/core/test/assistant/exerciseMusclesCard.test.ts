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
  assistantExerciseMusclesSchema,
  assistantStreamEventSchema,
  buildAssistantSheetThread,
  isSentTurnStored,
  parseAssistantEvent,
  threadFromMessages,
} from "../../src/assistant";
import { MUSCLE_IDS } from "../../src/training";

import type {
  AssistantCardLink,
  AssistantExerciseMuscles,
  AssistantSheetLiveTurn,
  AssistantThreadItem,
} from "../../src/assistant";

const romanianDeadlift: AssistantExerciseMuscles = {
  exerciseName: "Romanian Deadlift",
  muscles: [
    { muscle_id: "hamstrings", role: "primary" },
    { muscle_id: "glute_max", role: "secondary" },
  ],
};

const seatedLegCurl: AssistantExerciseMuscles = {
  exerciseName: "Seated Leg Curl",
  muscles: [{ muscle_id: "hamstrings", role: "primary" }],
};

const link: AssistantCardLink = {
  label: "Open in routine editor",
  target: { screen: "routine_editor", routineId },
};

describe("the exercise_muscles event", () => {
  it("should parse one muscle", () => {
    const event = { type: "exercise_muscles", exercise: seatedLegCurl };

    expect(assistantStreamEventSchema.parse(event)).toEqual(event);
  });

  it("should parse several muscles", () => {
    const event = { type: "exercise_muscles", exercise: romanianDeadlift };

    expect(assistantStreamEventSchema.parse(event)).toEqual(event);
  });

  it("should reject a muscle the list does not hold", () => {
    const exercise = { ...seatedLegCurl, muscles: [{ muscle_id: "pinky", role: "primary" }] };

    expect(assistantExerciseMusclesSchema.safeParse(exercise).success).toBe(false);
  });

  it("should reject a role the scale does not hold", () => {
    const exercise = { ...seatedLegCurl, muscles: [{ muscle_id: "hamstrings", role: "tertiary" }] };

    expect(assistantExerciseMusclesSchema.safeParse(exercise).success).toBe(false);
  });

  it("should reject a weight, which nothing draws", () => {
    const exercise = {
      ...seatedLegCurl,
      muscles: [{ muscle_id: "hamstrings", role: "primary", weight: 1 }],
    };

    expect(assistantExerciseMusclesSchema.safeParse(exercise).success).toBe(false);
  });

  it("should reject an extra key on the exercise", () => {
    expect(
      assistantExerciseMusclesSchema.safeParse({ ...seatedLegCurl, exerciseId: "x" }).success,
    ).toBe(false);
  });

  it("should take one row for each muscle of the list and no more", () => {
    const everyMuscle = MUSCLE_IDS.map((muscle_id) => ({ muscle_id, role: "primary" as const }));
    const withOneMore = [
      ...everyMuscle,
      { muscle_id: "hamstrings" as const, role: "primary" as const },
    ];

    expect(everyMuscle).toHaveLength(22);
    expect(
      assistantExerciseMusclesSchema.safeParse({ ...seatedLegCurl, muscles: everyMuscle }).success,
    ).toBe(true);
    expect(
      assistantExerciseMusclesSchema.safeParse({ ...seatedLegCurl, muscles: withOneMore }).success,
    ).toBe(false);
  });

  it("should reject no muscles and a blank name", () => {
    expect(
      assistantExerciseMusclesSchema.safeParse({ ...seatedLegCurl, muscles: [] }).success,
    ).toBe(false);
    expect(
      assistantExerciseMusclesSchema.safeParse({ ...seatedLegCurl, exerciseName: "" }).success,
    ).toBe(false);
  });

  it("should reject an event without its exercise", () => {
    expect(assistantStreamEventSchema.safeParse({ type: "exercise_muscles" }).success).toBe(false);
  });

  it("should be read by parseAssistantEvent, and name a bad field by its path without its value", () => {
    const good = parseAssistantEvent(
      JSON.stringify({ type: "exercise_muscles", exercise: seatedLegCurl }),
    );
    const bad = parseAssistantEvent(
      JSON.stringify({
        type: "exercise_muscles",
        exercise: {
          ...seatedLegCurl,
          muscles: [{ muscle_id: "hamstrings", role: "primary", weight: 1 }],
        },
      }),
    );

    expect(good).toEqual({
      ok: true,
      event: { type: "exercise_muscles", exercise: seatedLegCurl },
    });
    expect(bad).toEqual({
      ok: false,
      reason: "invalid_event",
      fieldPaths: ["exercise.muscles.0.weight"],
    });
  });
});

const storedTurn = (
  results: { toolUseId: string; outcome: unknown }[],
  words?: string,
  turnId: string = firstTurnId,
  ids = ["m1", "m2", "m3", "m4"],
  status?: "stopped" | "failed",
) => {
  const messages = [
    userMessage(ids[0] ?? "m1", turnId, "Which works my hamstrings more?"),
    toolUseMessage(
      ids[1] ?? "m2",
      turnId,
      results.map((result) => ({ id: result.toolUseId, name: "show_exercise_muscles" })),
    ),
    toolResultMessage(
      ids[2] ?? "m3",
      turnId,
      results.map((result) => ({ ...result, source: "show_exercise_muscles" })),
    ),
    ...(words === undefined ? [] : [replyMessage(ids[3] ?? "m4", turnId, words)]),
  ];
  return status === undefined ? messages : messages.map((one) => ({ ...one, turnStatus: status }));
};

describe("threadFromMessages, the muscles of an exercise", () => {
  const two = [
    { toolUseId: "call-1", outcome: { exerciseMuscles: romanianDeadlift } },
    { toolUseId: "call-2", outcome: { exerciseMuscles: seatedLegCurl } },
  ];

  it("should read two entries back as two items, in call order, after the reply", () => {
    const thread = threadFromMessages(storedTurn(two, "Both count a full set."), []);

    expect(thread.map((item) => item.kind)).toEqual([
      "user",
      "reply",
      "exercise_muscles",
      "exercise_muscles",
    ]);
    expect(thread[2]).toEqual({
      kind: "exercise_muscles",
      id: "m3:0:exerciseMuscles",
      exercise: romanianDeadlift,
    });
    expect(thread[3]).toMatchObject({ id: "m3:1:exerciseMuscles", exercise: seatedLegCurl });
  });

  it("should not merge two of them into one", () => {
    const thread = threadFromMessages(storedTurn(two), []);

    expect(thread.filter((item) => item.kind === "exercise_muscles")).toHaveLength(2);
  });

  it("should drop an entry that does not parse, and only that entry", () => {
    const thread = threadFromMessages(
      storedTurn([
        { toolUseId: "call-1", outcome: { exerciseMuscles: { exerciseName: "", muscles: [] } } },
        { toolUseId: "call-2", outcome: { exerciseMuscles: seatedLegCurl } },
      ]),
      [],
    );

    expect(thread.filter((item) => item.kind === "exercise_muscles")).toEqual([
      { kind: "exercise_muscles", id: "m3:1:exerciseMuscles", exercise: seatedLegCurl },
    ]);
  });

  it("should read an older app's row without the key as a turn with no muscles", () => {
    const thread = threadFromMessages(
      storedTurn([{ toolUseId: "call-1", outcome: {} }], "Hm."),
      [],
    );

    expect(thread.map((item) => item.kind)).toEqual(["user", "reply"]);
  });

  it("should keep the order reply, muscles, link, notice, Ask again", () => {
    const thread = threadFromMessages(
      storedTurn(
        [
          {
            toolUseId: "call-1",
            outcome: { exerciseMuscles: seatedLegCurl, link, askAgain: true },
          },
        ],
        "Words.",
        firstTurnId,
        ["m1", "m2", "m3", "m4"],
        "failed",
      ),
      [],
    );

    expect(thread.map((item) => item.kind)).toEqual([
      "user",
      "reply",
      "exercise_muscles",
      "link",
      "notice",
      "ask_again",
    ]);
  });

  it("should give the two items distinct keys in the sheet", () => {
    const keys = buildAssistantSheetThread({
      items: threadFromMessages(storedTurn(two), []),
      sent: null,
      live: null,
      isStreaming: false,
    }).entries.map((entry) => entry.key);

    expect(new Set(keys).size).toBe(keys.length);
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

const storedItem = (id: string, exercise: AssistantExerciseMuscles) =>
  ({ kind: "exercise_muscles", id, exercise }) satisfies AssistantThreadItem;

describe("buildAssistantSheetThread, the muscles of an exercise", () => {
  it("should draw a stored one as an entry of its own", () => {
    expect(build({ items: [storedItem("e1", seatedLegCurl)] }).entries).toEqual([
      { kind: "exerciseMuscles", key: "e1", exercise: seatedLegCurl },
    ]);
  });

  it("should hand the card the same exercise object, stored or live, so a memoised card is not drawn again", () => {
    const stored = build({ items: [storedItem("e1", seatedLegCurl)] }).entries[0];
    const sent = { text: "Hello", afterItemId: null };
    const live = build({ sent, live: liveTurn({ exerciseMuscles: [seatedLegCurl] }) }).entries[1];

    expect(stored).toMatchObject({ exercise: seatedLegCurl });
    expect(stored?.kind === "exerciseMuscles" && stored.exercise).toBe(seatedLegCurl);
    expect(live?.kind === "exerciseMuscles" && live.exercise).toBe(seatedLegCurl);
  });

  it("should draw the reply of the turn on screen, then its cards", () => {
    const sent = { text: "Which works my hamstrings more?", afterItemId: null };
    const live = liveTurn({
      text: "Both count a full set.",
      exerciseMuscles: [romanianDeadlift, seatedLegCurl],
      outcome: "complete",
    });

    const entries = build({ sent, live }).entries;

    expect(entries.map((entry) => entry.kind)).toEqual([
      "you",
      "assistant",
      "exerciseMuscles",
      "exerciseMuscles",
    ]);
    expect(entries.map((entry) => entry.key)).toEqual([
      "sent:you",
      "sent:reply",
      "sent:exerciseMuscles:0",
      "sent:exerciseMuscles:1",
    ]);
  });

  it("should draw them before the link, the notice and Ask again of the turn on screen", () => {
    const sent = { text: "Which works my hamstrings more?", afterItemId: null };
    const live = liveTurn({
      text: "Words.",
      exerciseMuscles: [seatedLegCurl],
      link,
      notice: { code: "turn_failed" },
      askAgain: true,
      outcome: "failed",
    });

    expect(build({ sent, live }).entries.map((entry) => entry.kind)).toEqual([
      "you",
      "assistant",
      "exerciseMuscles",
      "link",
      "notice",
      "askAgain",
    ]);
  });

  it("should draw a card that lands while the reply is still streaming", () => {
    const sent = { text: "Which works my hamstrings more?", afterItemId: null };
    const live = liveTurn({ text: "Both count", exerciseMuscles: [seatedLegCurl] });

    expect(build({ sent, live, isStreaming: true }).entries.map((entry) => entry.kind)).toEqual([
      "you",
      "assistant",
      "exerciseMuscles",
    ]);
  });

  it("should draw it for a turn with no words", () => {
    const sent = { text: "Which works my hamstrings more?", afterItemId: null };
    const live = liveTurn({ exerciseMuscles: [seatedLegCurl], outcome: "complete" });

    expect(build({ sent, live }).entries.map((entry) => entry.kind)).toEqual([
      "you",
      "exerciseMuscles",
    ]);
  });

  describe("needsFullHeight", () => {
    it("should be true with one in the thread", () => {
      expect(build({ items: [storedItem("e1", seatedLegCurl)] }).needsFullHeight).toBe(true);
    });

    it("should be true when it is not the last entry", () => {
      const items: AssistantThreadItem[] = [
        storedItem("e1", seatedLegCurl),
        { kind: "user", id: "u2", text: "Thanks" },
        { kind: "reply", id: "r2", text: "Welcome.", answerMeta: null, stopped: false },
      ];

      expect(build({ items }).needsFullHeight).toBe(true);
    });

    it("should be true for one in the turn on screen", () => {
      const sent = { text: "Hello", afterItemId: null };

      expect(
        build({ sent, live: liveTurn({ exerciseMuscles: [seatedLegCurl] }) }).needsFullHeight,
      ).toBe(true);
    });

    it("should be false with none", () => {
      expect(
        build({
          items: [{ kind: "reply", id: "r1", text: "Hi.", answerMeta: null, stopped: false }],
        }).needsFullHeight,
      ).toBe(false);
      expect(build().needsFullHeight).toBe(false);
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
        storedItem("e1", seatedLegCurl),
        storedItem("e2", romanianDeadlift),
      ];

      expect(build({ items }).canAskAgain).toBe(true);
    });

    it("should be true for a stopped reply with a card of the turn on screen under it", () => {
      const sent = { text: "Hello", afterItemId: null };
      const live = liveTurn({ text: "Partly", stopped: true, exerciseMuscles: [seatedLegCurl] });

      expect(build({ sent, live }).canAskAgain).toBe(true);
    });

    it("should be false for a reply that was not stopped", () => {
      const items: AssistantThreadItem[] = [
        { ...stoppedReply, stopped: false },
        storedItem("e1", seatedLegCurl),
      ];

      expect(build({ items }).canAskAgain).toBe(false);
    });

    it("should be false for a card with no reply before it", () => {
      expect(build({ items: [storedItem("e1", seatedLegCurl)] }).canAskAgain).toBe(false);
    });
  });
});

describe("isSentTurnStored, the muscles of an exercise", () => {
  const items: AssistantThreadItem[] = [
    { kind: "user", id: "u1", text: "Hello" },
    storedItem("e1", seatedLegCurl),
  ];

  it("should count a stored one as the end of a turn with no words", () => {
    expect(isSentTurnStored(items, null, null)).toBe(true);
    expect(isSentTurnStored(items, "u1", { text: "" })).toBe(true);
  });

  it("should not count it while the reply is still to come", () => {
    expect(isSentTurnStored(items, "u1", { text: "Words to come" })).toBe(false);
  });

  it("should count the reply that follows it", () => {
    const withReply: AssistantThreadItem[] = [
      ...items,
      { kind: "reply", id: "r1", text: "Words.", answerMeta: null, stopped: false },
    ];

    expect(isSentTurnStored(withReply, "u1", { text: "Words" })).toBe(true);
  });
});

describe("a later turn after a card", () => {
  it("should leave the first turn's card and answer its Ask again", () => {
    const thread = threadFromMessages(
      [
        ...storedTurn([{ toolUseId: "call-1", outcome: { exerciseMuscles: seatedLegCurl } }], "A."),
        ...storedTurn([], "B.", secondTurnId, ["m5", "m6", "m7", "m8"]),
      ],
      [],
    );

    expect(thread.filter((item) => item.kind === "exercise_muscles")).toHaveLength(1);
  });
});
