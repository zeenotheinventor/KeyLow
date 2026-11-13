import { describe, expect, it } from "vitest";

import { fakeDatabase, turnResult } from "./helpers.ts";
import { suggestionDraft } from "./kitchenDrafts.ts";
import { isKitchenTurn } from "./kitchenMatcher.ts";
import { fakeKitchenWorld } from "./kitchenWorldFake.ts";
import { createPalateJudgeCases, judgedFit } from "../cases/palateJudge.ts";
import {
  RUBRIC_MAXIMUM,
  RUBRIC_PASS_SCORE,
  RUBRIC_SYSTEM,
  draftTextOf,
  judgeRequestOf,
  profileTextOf,
  readRubricScore,
} from "../cases/palateJudgeRubric.ts";
import { expectedPalateProfile } from "../fixtures/palateProfile.ts";
import { createJudge } from "../src/judge.ts";
import { OPT_IN_SET_NAMES, THRESHOLD_PERCENT } from "../src/thresholds.ts";

import type { JudgeClient } from "../src/judge.ts";

// Nothing here reaches a model: the judge is given a client that answers from a list, and the rubric is read from replies
// written by hand.

const profile = expectedPalateProfile("2026-11-13");
const draft = suggestionDraft();

const score = (fields: Record<string, unknown>) =>
  JSON.stringify({ fit: 2, avoided: false, variety: 1, plausible: 2, reason: "fits", ...fields });

function judgeAnswering(...replies: string[]) {
  const asked: string[] = [];
  const client: JudgeClient = {
    ask: ({ user }) => {
      asked.push(user);
      const text = replies[asked.length - 1];
      return text === undefined
        ? Promise.reject(new Error("the judge has no reply left"))
        : Promise.resolve({ text, inputTokens: 700, outputTokens: 50 });
    },
  };
  return { judge: createJudge(client), asked };
}

const draftTurn = () => turnResult({ recipeDrafts: [draft] });

describe("the palateJudge set", () => {
  const { world } = fakeKitchenWorld();
  const { judge } = judgeAnswering();
  const cases = createPalateJudgeCases(() => world, judge);

  it("should be opt in, at 80 % of cases scoring 4 or 5 of 5", () => {
    expect(THRESHOLD_PERCENT.palateJudge).toBe(80);
    expect(RUBRIC_PASS_SCORE).toBe(4);
    expect(RUBRIC_MAXIMUM).toBe(5);
    expect(OPT_IN_SET_NAMES).toContain("palateJudge");
    expect(cases.every(({ set }) => set === "palateJudge")).toBe(true);
  });

  it("should have six cases with distinct ids, each asking for one recipe in a kitchen turn", async () => {
    const verdicts = await Promise.all(cases.map(({ messages }) => isKitchenTurn(messages[0])));

    expect(cases).toHaveLength(6);
    expect(new Set(cases.map(({ id }) => id)).size).toBe(6);
    expect(cases.every(({ messages }) => messages.length === 1)).toBe(true);
    expect(verdicts.every(Boolean)).toBe(true);
  });

  it("should have no must-pass case, because a judge's score never decides a deterministic case", () => {
    expect(cases.some(({ mustPass }) => mustPass === true)).toBe(false);
  });
});

describe("judgedFit", () => {
  const grade = (judge: ReturnType<typeof judgeAnswering>["judge"], turn = draftTurn()) =>
    judgedFit(judge, () => profile)({ turns: [turn], database: fakeDatabase() });

  it("should pass a recipe the judge scores 5 of 5, and say what it scored and how many tokens it used", async () => {
    const { judge } = judgeAnswering(score({}));

    const outcome = await grade(judge);

    expect(outcome.passed).toBe(true);
    expect(outcome.reason).toBe(
      "scored 5 of 5 (fit 2, variety 1, plausible 2), the judge used 750 tokens",
    );
  });

  it("should pass a 4 and fail a 3, the line of the threshold", async () => {
    expect((await grade(judgeAnswering(score({ plausible: 1 })).judge)).passed).toBe(true);
    expect((await grade(judgeAnswering(score({ plausible: 0 })).judge)).passed).toBe(false);
  });

  it("should fail a recipe with an avoided food whatever else the judge scored, and say so", async () => {
    const outcome = await grade(judgeAnswering(score({ avoided: true })).judge);

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toBe(
      "scored 0 of 5 (fit 2, variety 1, plausible 2, an avoided food), the judge used 750 tokens",
    );
  });

  it("should fail with no call to the judge when there is no draft to judge", async () => {
    const { judge, asked } = judgeAnswering(score({}));

    const outcome = await grade(judge, turnResult());

    expect(outcome.passed).toBe(false);
    expect(asked).toHaveLength(0);
    expect(judge.tokens()).toBe(0);
  });

  it("should reject when the judge's reply cannot be read, so the case is an error and not a low score", async () => {
    await expect(grade(judgeAnswering("I think it is nice").judge)).rejects.toThrow(
      "not a JSON score",
    );
  });

  it("should send the judge the profile and the draft and nothing else", async () => {
    const { judge, asked } = judgeAnswering(score({}));

    await grade(judge);

    expect(asked).toEqual([judgeRequestOf(profile, draft).user]);
  });

  it("should count the tokens of every case in the judge's total", async () => {
    const { judge } = judgeAnswering(score({}), score({}));

    await grade(judge);
    await grade(judge);

    expect(judge.tokens()).toBe(1_500);
  });

  it("should judge the cases' drafts through the factory's judge, and ensure the world first", async () => {
    const { world, calls } = fakeKitchenWorld();
    const { judge } = judgeAnswering(score({}));
    const [first] = createPalateJudgeCases(() => world, judge);

    await first?.prepare?.();
    const outcomes = await Promise.all(
      (first?.expect ?? []).map((grader) =>
        grader({ turns: [draftTurn()], database: fakeDatabase() }),
      ),
    );

    expect(calls).toEqual(["ensureWorld"]);
    expect(outcomes.filter(({ passed }) => !passed)).toEqual([]);
  });
});

describe("readRubricScore", () => {
  it("should add fit, variety and plausible up, and read a reply wrapped in a code fence or a sentence", () => {
    expect(readRubricScore(score({ fit: 1, variety: 0, plausible: 2 }))).toMatchObject({
      total: 3,
    });
    expect(readRubricScore(`\`\`\`json\n${score({})}\n\`\`\``).total).toBe(5);
    expect(readRubricScore(`Here is my score: ${score({ fit: 1 })} Thanks.`).total).toBe(4);
  });

  it("should score an avoided food 0 whatever the rest is", () => {
    expect(readRubricScore(score({ avoided: true }))).toMatchObject({ avoided: true, total: 0 });
  });

  it.each([
    ["a fit above 2", { fit: 3 }],
    ["a negative variety", { variety: -1 }],
    ["a variety of 2", { variety: 2 }],
    ["a fractional plausible", { plausible: 1.5 }],
    ["an avoided that is not a boolean", { avoided: "no" }],
    ["a missing fit", { fit: undefined }],
  ])("should throw for %s", (_label, fields) => {
    expect(() => readRubricScore(score(fields))).toThrow(
      "missing a field or holds a value out of range",
    );
  });

  it.each(["", "no json", "{not json}", "[1, 2]", "null"])(
    "should throw for the reply %j",
    (reply) => {
      expect(() => readRubricScore(reply)).toThrow("not a JSON score");
    },
  );

  it("should never put the reply in the message", () => {
    expect(() => readRubricScore("a secret recipe name")).not.toThrow(/secret/);
  });
});

describe("the rubric's request", () => {
  it("should hold the four things scored and the instruction to answer JSON only", () => {
    for (const word of ["fit", "avoided", "variety", "plausible", "only a JSON object"]) {
      expect(RUBRIC_SYSTEM).toContain(word);
    }
  });

  it("should describe the palate in words: usual foods by how often, time of day, what is rare and what is avoided", () => {
    const text = profileTextOf(profile);

    expect(text).toContain("Eats bread, eggs, apples, broccoli most days.");
    expect(text).toContain("Usually in the morning: bread, eggs, apples.");
    expect(text).toContain("Rarely or never eats legumes and nuts, sweets and snacks, drinks.");
    expect(text).toContain("Avoids peanuts (allergy), mushrooms (dislike), coriander (dislike).");
  });

  it("should describe the draft: its name, a serving's figures, each line with its grams and the steps", () => {
    const text = draftTextOf(draft);

    expect(text).toContain("Chicken and rice plate");
    expect(text).toMatch(/One serving: \d+ kcal, \d+ g protein, \d+ g carbs, \d+ g fat\./);
    expect(text).toContain("g chicken breast");
    expect(text).toContain("1. Grill the chicken.");
  });

  it("should wrap the profile and the draft in their own tags and give the rubric as the system prompt", () => {
    const request = judgeRequestOf(profile, draft);

    expect(request.system).toBe(RUBRIC_SYSTEM);
    expect(request.user).toMatch(
      /^<profile>\n[\s\S]+\n<\/profile>\n<recipe>\n[\s\S]+\n<\/recipe>$/,
    );
  });
});
