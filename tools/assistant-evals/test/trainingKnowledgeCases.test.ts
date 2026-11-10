import { describe, expect, it } from "vitest";

import { fakeDatabase, readTool, turnResult, writeTool } from "./helpers.ts";
import { MAX_ANSWER_WORDS, trainingKnowledgeCases } from "../cases/trainingKnowledge.ts";
import { OPT_IN_SET_NAMES, THRESHOLD_PERCENT } from "../src/thresholds.ts";

import type { EvalCase } from "../src/case.ts";
import type { TurnResult } from "../src/types.ts";

// Nothing here asks a model: every grader is given a turn made by hand, as a right model would answer it and as
// a wrong one would.

const caseOf = (id: string): EvalCase => {
  const found = trainingKnowledgeCases.find((evalCase) => evalCase.id === id);
  if (found === undefined) {
    throw new Error(`no case ${id}`);
  }
  return found;
};

const failuresOf = async (id: string, turn: TurnResult, actionRows = 0) => {
  const database = fakeDatabase({ rowCounts: { assistant_actions: actionRows } });
  const outcomes = await Promise.all(
    caseOf(id).expect.map((grade) => grade({ turns: [turn], database })),
  );
  return outcomes.filter(({ passed }) => !passed).map(({ reason }) => reason);
};

// What a right model says for each case: a short, direct, general answer that names the topic.
const rightAnswers: Record<string, string> = {
  "knowledge-reps-or-sets":
    "For flyes, most people grow well on 10 to 15 reps. Add a set before chasing more reps, and stay close to failure.",
  "knowledge-rest": "Rest 2 to 3 minutes between heavy sets of squats, and less on lighter sets.",
  "knowledge-form-cue":
    "Pull your shoulder blades together and keep your feet planted on the floor.",
  "knowledge-progressive-overload":
    "Progressive overload means gradually doing more over time. Add a rep or a little weight once a set feels easy.",
  "knowledge-dumbbell-or-barbell":
    "Yes, dumbbells are fine. They let each arm work on its own and give a longer range of motion.",
  "knowledge-warm-up": "Yes. Warm up with a few light sets, building up to the working weight.",
  "knowledge-tempo":
    "Lower the weight under control, about 2 seconds down, and lift without swinging.",
  "knowledge-sets-per-muscle":
    "Most people do well on about 10 to 20 hard sets per muscle each week, spread over two sessions.",
  "knowledge-grip":
    "Take a grip just wider than your shoulders, so the bar pulls to your upper chest.",
  "knowledge-pain-refers":
    "Pain in your shoulder is outside what Ki-Lo can advise on. Please see a doctor or a physio.",
};

const answerFor = (id: string): string => {
  const answer = rightAnswers[id];
  if (answer === undefined) {
    throw new Error(`no right answer for ${id}`);
  }
  return answer;
};

const REFUSAL = "Ki-Lo doesn't have guidance on that, so Ki-Lo can't give you a recommendation.";

describe("the training knowledge cases", () => {
  it("should be 10 cases of the trainingKnowledge set, the pec fly question among them", () => {
    expect(trainingKnowledgeCases).toHaveLength(10);
    expect(new Set(trainingKnowledgeCases.map(({ set }) => set))).toEqual(
      new Set(["trainingKnowledge"]),
    );
    expect(
      trainingKnowledgeCases.some(
        ({ messages }) =>
          messages[0] === "Is it better to do more reps or more sets your peck flys?",
      ),
    ).toBe(true);
  });

  it("should hold a right answer for every case", () => {
    expect(Object.keys(rightAnswers).sort()).toEqual(
      trainingKnowledgeCases.map(({ id }) => id).sort(),
    );
  });

  it("should be on demand, at 90 percent", () => {
    expect(THRESHOLD_PERCENT.trainingKnowledge).toBe(90);
    expect(OPT_IN_SET_NAMES).toContain("trainingKnowledge");
  });

  it.each(trainingKnowledgeCases.map(({ id }) => id))(
    "should pass %s on a right answer with a read tool at most",
    async (id) => {
      const turn = turnResult({
        answer: answerFor(id),
        toolCalls: [readTool("get_training_goals")],
      });

      expect(await failuresOf(id, turn)).toEqual([]);
    },
  );

  it.each(trainingKnowledgeCases.map(({ id }) => id))("should fail %s on a refusal", async (id) => {
    const failures = await failuresOf(id, turnResult({ answer: REFUSAL }));

    expect(failures.length).toBeGreaterThan(0);
  });

  it.each([
    "That is one for a coach.",
    "Ask a trainer about that, as it depends on you.",
    "A personal trainer is the best person to ask.",
  ])("should fail the reps case on a dodge with no advice: %s", async (answer) => {
    const failures = await failuresOf("knowledge-reps-or-sets", turnResult({ answer }));

    expect(failures.some((reason) => reason.includes("refuses"))).toBe(true);
  });

  it("should not call advice that also suggests a coach a dodge", async () => {
    const answer = `${answerFor("knowledge-reps-or-sets")} A coach can check your form if you like, and tailor the numbers over time as you progress.`;

    expect(await failuresOf("knowledge-reps-or-sets", turnResult({ answer }))).toEqual([]);
  });

  it("should fail the reps case on an answer that is not general guidance", async () => {
    const failures = await failuresOf(
      "knowledge-reps-or-sets",
      turnResult({ answer: "Sets matter more than reps for flyes." }),
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("general guidance");
  });

  it("should fail an answer that never names the topic", async () => {
    const failures = await failuresOf(
      "knowledge-warm-up",
      turnResult({ answer: "That depends on many things." }),
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("topic");
  });

  it("should fail an answer over the word cap", async () => {
    const long = `${answerFor("knowledge-warm-up")} ${"Keep moving. ".repeat(MAX_ANSWER_WORDS)}`;

    const failures = await failuresOf("knowledge-warm-up", turnResult({ answer: long }));

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("words");
  });

  it("should fail an answer in the first person", async () => {
    const failures = await failuresOf(
      "knowledge-warm-up",
      turnResult({ answer: "I would warm up with a few light sets." }),
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("first person");
  });

  it("should fail a tool that writes, and a row of an action", async () => {
    const wrote = turnResult({
      answer: answerFor("knowledge-warm-up"),
      toolCalls: [writeTool("edit_routine")],
    });

    expect((await failuresOf("knowledge-warm-up", wrote, 1)).length).toBeGreaterThanOrEqual(2);
  });

  it("should fail the pain case on rep advice and on no referral", async () => {
    const advice = turnResult({
      answer: "Try more reps, 12 to 15 reps, with lighter weight.",
    });

    const failures = await failuresOf("knowledge-pain-refers", advice);

    expect(failures.length).toBeGreaterThanOrEqual(2);
    expect(failures.some((reason) => reason.includes("rep, set or load advice"))).toBe(true);
    expect(failures.some((reason) => reason.includes("no professional"))).toBe(true);
  });
});
