import { describe, expect, it } from "vitest";

import { fakeDatabase, readTool, turnResult, writeTool } from "./helpers.ts";
import { READ_TOOLS } from "../cases/ask.ts";
import {
  atMostTwoFormCards,
  exerciseFormCasesOf,
  formCardsFor,
  noFormCardDrawn,
  noVideoTitleInReply,
  noLinkInReply,
  saysItInOneSentence,
} from "../cases/exerciseForm.ts";
import { CUSTOM_EXERCISE } from "../fixtures/training.ts";
import { THRESHOLD_PERCENT } from "../src/thresholds.ts";

import type { EvalCase, GradeContext, Grader } from "../src/case.ts";
import type { TrainingWorld } from "../src/trainingWorld.ts";
import type { TurnResult } from "../src/types.ts";
import type { AssistantExerciseFormMedia } from "@keylow/core";

// Nothing here asks a model: every grader is given a turn made by hand, as a right model would answer it and as
// a wrong one would.

const calls: string[] = [];
const notUsed = () => Promise.reject(new Error("the world is not used by a grader"));
const world: TrainingWorld = {
  anchorDate: "2026-11-11",
  ensureHistory: () => {
    calls.push("history");
    return Promise.resolve();
  },
  exerciseIds: notUsed,
  exerciseName: notUsed,
  suggestion: notUsed,
  muscleFacts: notUsed,
  clearGoal: notUsed,
  restoreGoal: notUsed,
  startWorkout: notUsed,
  discardWorkout: notUsed,
};

const cases = exerciseFormCasesOf(() => world);
const caseOf = (id: string): EvalCase => {
  const found = cases.find((evalCase) => evalCase.id === id);
  if (found === undefined) {
    throw new Error(`no case ${id}`);
  }
  return found;
};

const squat: AssistantExerciseFormMedia = {
  exerciseName: "Barbell Squat",
  media: { kind: "video", videoId: "dQw4w9WgXcQ", title: "High bar squat guide", channel: "A" },
};
const hipThrust: AssistantExerciseFormMedia = {
  exerciseName: "Barbell Hip Thrust",
  media: {
    kind: "video",
    videoId: "xDmFkJxPzeM",
    title: "Perfect hip thrust technique",
    channel: "B",
  },
};
const abRoller: AssistantExerciseFormMedia = {
  exerciseName: "Ab Roller",
  media: { kind: "photos", imagePaths: ["Ab_Roller/0.jpg", "Ab_Roller/1.jpg"] },
};

const showForm = (id: string) => readTool("show_exercise_form", { exercise_id: id });
const searchFor = (query: string) => readTool("search_exercises", { query });

const contextOf = (turn: TurnResult): GradeContext => ({ turns: [turn], database: fakeDatabase() });
const outcomeOf = (grade: Grader, turn: TurnResult) => grade(contextOf(turn));

const failuresOf = async (id: string, turn: TurnResult) =>
  (await Promise.all(caseOf(id).expect.map((grade) => grade(contextOf(turn)))))
    .filter(({ passed }) => !passed)
    .map(({ reason }) => reason);

// What a right model does for each case: the searches, the calls, the cards and a short reply with no link.
const rightTurns: Record<string, Partial<TurnResult>> = {
  "form-one": {
    answer: "Brace the core and keep the knees over the toes.",
    toolCalls: [searchFor("barbell squat"), showForm("a")],
    exerciseFormMedia: [squat],
  },
  "form-show": {
    answer: "Keep the chest up and push through the whole foot.",
    toolCalls: [searchFor("squat"), showForm("a")],
    exerciseFormMedia: [squat],
  },
  "form-photos": {
    answer: "Keep the hips low and roll out slowly.",
    toolCalls: [searchFor("ab roller"), showForm("c")],
    exerciseFormMedia: [abRoller],
  },
  "form-two": {
    answer: "Both are shown below.",
    toolCalls: [searchFor("squat"), searchFor("hip thrust"), showForm("a"), showForm("b")],
    exerciseFormMedia: [squat, hipThrust],
  },
  "form-many": {
    answer: "Two are shown. Which of the others next?",
    toolCalls: [searchFor("squat"), showForm("a"), showForm("b")],
    exerciseFormMedia: [squat, hipThrust],
  },
  "form-custom": {
    answer: "No form guide is held for that exercise.",
    toolCalls: [searchFor("face pull"), showForm("d")],
  },
  "form-unknown": {
    answer: "No exercise by that name was found.",
    toolCalls: [searchFor("zorblat press")],
  },
  "form-pain": {
    answer: "That is outside what Ki-Lo does, so ask a doctor or a physio.",
    toolCalls: [],
  },
};

const turnFor = (id: string, change: Partial<TurnResult> = {}) =>
  turnResult({ ...rightTurns[id], ...change });

describe("the form cases", () => {
  it("should be 8 cases of the trainingAdvice set, none of them must-pass", () => {
    expect(cases.map(({ id }) => id)).toEqual([
      "form-one",
      "form-show",
      "form-photos",
      "form-two",
      "form-many",
      "form-custom",
      "form-unknown",
      "form-pain",
    ]);
    expect(cases.every(({ set }) => set === "trainingAdvice")).toBe(true);
    expect(cases.some(({ mustPass }) => mustPass === true)).toBe(false);
    expect(THRESHOLD_PERCENT.trainingAdvice).toBe(90);
  });

  it("should give every case its own id and its own question, in plain British English", () => {
    expect(new Set(cases.map(({ id }) => id)).size).toBe(8);
    expect(new Set(cases.flatMap(({ messages }) => messages)).size).toBe(8);
    for (const message of cases.flatMap(({ messages }) => messages)) {
      expect(message).not.toMatch(/—/);
    }
  });

  it("should ask the custom exercise by the name the fixture gave it", () => {
    expect(caseOf("form-custom").messages).toEqual([`How do I do my ${CUSTOM_EXERCISE.name}?`]);
  });

  it("should write the history before the case, as the other cases of the set do", async () => {
    calls.length = 0;

    await caseOf("form-one").prepare?.();

    expect(calls).toEqual(["history"]);
  });

  it("should know the tool as a read tool, so a food question that reaches for it is another matter", () => {
    expect(READ_TOOLS.has("show_exercise_form")).toBe(true);
  });

  it("should pass every case for the turn a right model gives", async () => {
    for (const { id } of cases) {
      expect(await failuresOf(id, turnFor(id)), id).toEqual([]);
    }
  });
});

describe("which cards were drawn", () => {
  it("should fail a case when the tool was called and no card was drawn", async () => {
    const failures = await failuresOf("form-one", turnFor("form-one", { exerciseFormMedia: [] }));

    expect(failures.some((reason) => reason.includes("0 cards"))).toBe(true);
  });

  it("should fail a card for an exercise that is not the one asked about", async () => {
    const failures = await failuresOf(
      "form-one",
      turnFor("form-one", { exerciseFormMedia: [abRoller] }),
    );

    expect(failures.some((reason) => reason.includes("no card was drawn for"))).toBe(true);
  });

  it("should fail a photos card where a video was expected, and the other way round", async () => {
    const photosOfSquat: AssistantExerciseFormMedia = {
      exerciseName: "Barbell Squat",
      media: { kind: "photos", imagePaths: ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"] },
    };

    expect(
      (await failuresOf("form-one", turnFor("form-one", { exerciseFormMedia: [photosOfSquat] })))
        .length,
    ).toBeGreaterThan(0);
    expect(
      (await failuresOf("form-photos", turnFor("form-photos", { exerciseFormMedia: [squat] })))
        .length,
    ).toBeGreaterThan(0);
  });

  it("should need a card for each of the two exercises of a question about two", async () => {
    const failures = await failuresOf(
      "form-two",
      turnFor("form-two", { exerciseFormMedia: [squat] }),
    );

    expect(failures.length).toBeGreaterThan(0);
  });

  it("should take any card of the kind when none is named, and fail two cards for one exercise", async () => {
    const grade = formCardsFor({ exercise: /squat/i });

    expect((await outcomeOf(grade, turnResult({ exerciseFormMedia: [squat] }))).passed).toBe(true);
    expect((await outcomeOf(grade, turnResult({ exerciseFormMedia: [squat, squat] }))).passed).toBe(
      false,
    );
  });

  it("should pass three exercises shown as at most two cards, or as none with a question, and fail three cards", async () => {
    const grade = atMostTwoFormCards();

    expect(
      (await outcomeOf(grade, turnResult({ exerciseFormMedia: [squat, hipThrust] }))).passed,
    ).toBe(true);
    expect((await outcomeOf(grade, turnResult())).passed).toBe(true);
    expect(
      (await outcomeOf(grade, turnResult({ exerciseFormMedia: [squat, hipThrust, abRoller] })))
        .passed,
    ).toBe(false);
  });

  it("should fail a card for an exercise that is not there, or one that holds no guide", async () => {
    for (const id of ["form-unknown", "form-custom", "form-pain"]) {
      const failures = await failuresOf(id, turnFor(id, { exerciseFormMedia: [squat] }));
      expect(failures.length, id).toBeGreaterThan(0);
    }
    expect((await outcomeOf(noFormCardDrawn(), turnResult())).passed).toBe(true);
  });
});

describe("what the reply says", () => {
  it("should fail a reply that holds a link, a URL or youtube.com, however it is written", async () => {
    for (const answer of [
      "Watch it at https://example.org/squat.",
      "See www.example.org for the squat.",
      "Search youtube.com for a squat.",
      "It is on youtu.be/abc.",
      "Try example.com for a squat.",
    ]) {
      expect((await outcomeOf(noLinkInReply(), turnResult({ answer }))).passed, answer).toBe(false);
    }
  });

  it("should take a reply with no address in it", async () => {
    const answer = "Brace the core. Keep the knees over the toes.";

    expect((await outcomeOf(noLinkInReply(), turnResult({ answer }))).passed).toBe(true);
  });

  const benchPressVideo: AssistantExerciseFormMedia = {
    exerciseName: "Barbell Bench Press - Medium Grip",
    media: {
      kind: "video",
      videoId: "vcBig73ojpE",
      title: "How To Get A Huge Bench Press with Perfect Technique",
      channel: "C",
    },
  };
  const highBarSquat: AssistantExerciseFormMedia = {
    exerciseName: "Barbell Squat",
    media: { kind: "video", videoId: "i7J5h7BJ07g", title: "High Bar Squat", channel: "D" },
  };

  it("should fail a reply that holds a long drawn title, however it is cased or spaced", async () => {
    for (const answer of [
      "Watch How to get a huge bench press with perfect technique for the cues.",
      "The guide HOW TO GET A HUGE   BENCH PRESS WITH PERFECT TECHNIQUE is shown.",
    ]) {
      const outcome = await outcomeOf(
        noVideoTitleInReply(),
        turnResult({ answer, exerciseFormMedia: [benchPressVideo] }),
      );

      expect(outcome.passed, answer).toBe(false);
    }
  });

  it("should fail the long title of the other card of a turn that drew two", async () => {
    const answer = "Also see How To Get A Huge Bench Press with Perfect Technique.";

    const outcome = await outcomeOf(
      noVideoTitleInReply(),
      turnResult({ answer, exerciseFormMedia: [squat, benchPressVideo] }),
    );

    expect(outcome.passed).toBe(false);
  });

  it("should take a reply that quotes a cue of 3 words or more", async () => {
    const answer = 'Say "Keep the back flat and drive up through the whole foot." to yourself.';

    expect(
      (await outcomeOf(noVideoTitleInReply(), turnResult({ answer, exerciseFormMedia: [squat] })))
        .passed,
    ).toBe(true);
  });

  it("should take a natural mention when the title is only the name of an exercise", async () => {
    const answer = "Set up for a high bar squat with the bar on the traps.";

    expect(
      (
        await outcomeOf(
          noVideoTitleInReply(),
          turnResult({ answer, exerciseFormMedia: [highBarSquat] }),
        )
      ).passed,
    ).toBe(true);
  });

  it("should take a title of fewer than 4 words that is no part of the name, as a short title is not told from a cue", async () => {
    const answer = "Try a machine crunch with a slow tempo.";
    const machineCrunch: AssistantExerciseFormMedia = {
      exerciseName: "Ab Crunch Machine",
      media: { kind: "video", videoId: "-OUSBPnHvsQ", title: "Machine Crunch", channel: "E" },
    };

    expect(
      (
        await outcomeOf(
          noVideoTitleInReply(),
          turnResult({ answer, exerciseFormMedia: [machineCrunch] }),
        )
      ).passed,
    ).toBe(true);
  });

  it("should take a nothing-found reply of one sentence, and fail a longer one or a question mark chain", async () => {
    const grade = saysItInOneSentence();

    expect(
      (await outcomeOf(grade, turnResult({ answer: "No form guide is held for that exercise." })))
        .passed,
    ).toBe(true);
    expect(
      (
        await outcomeOf(
          grade,
          turnResult({ answer: "No form guide is held. Keep the back flat and brace." }),
        )
      ).passed,
    ).toBe(false);
    expect((await outcomeOf(grade, turnResult({ answer: "" }))).passed).toBe(true);
  });

  it("should not print the reply in a failure, only the question and the tools", async () => {
    const answer = "Watch it at https://example.org/sentinel-squat.";

    const failures = await failuresOf("form-one", turnFor("form-one", { answer }));

    expect(failures.length).toBeGreaterThan(0);
    for (const reason of failures) {
      expect(reason).not.toContain("sentinel");
    }
    expect(failures.some((reason) => reason.includes("question:"))).toBe(true);
  });
});

describe("what fails the set whatever the percentage", () => {
  it("should mark a write and an action row as critical", async () => {
    const failing = await Promise.all(
      caseOf("form-one").expect.map((grade) =>
        grade({
          turns: [turnFor("form-one", { toolCalls: [writeTool("log_entry")] })],
          database: fakeDatabase({ rowCounts: { assistant_actions: 1 } }),
        }),
      ),
    );

    const critical = failing.filter((outcome) => !outcome.passed && outcome.critical === true);
    expect(critical.length).toBeGreaterThanOrEqual(2);
  });

  it("should fail the first person as a soft miss", async () => {
    const failures = await Promise.all(
      caseOf("form-one").expect.map((grade) =>
        grade(contextOf(turnFor("form-one", { answer: "I would keep the knees out." }))),
      ),
    );

    expect(failures.some((outcome) => !outcome.passed && outcome.soft === true)).toBe(true);
  });

  it("should fail the pain case for a diagnosis or a plan, with no card", async () => {
    const failures = await failuresOf(
      "form-pain",
      turnFor("form-pain", {
        answer: "That sounds like patellar tendinitis, so rest for six weeks.",
      }),
    );

    expect(failures.length).toBeGreaterThan(0);
  });
});
