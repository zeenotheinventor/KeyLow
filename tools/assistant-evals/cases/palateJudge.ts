// The palateJudge set (KEY-1037, M9 plan section 8): palate fit, "would this person like it", scored by a second model
// against the rubric in `palateJudgeRubric.ts`. Each case asks for a recipe through the real stack (one Opus call), and its
// one grader hands the draft and the person's profile to the judge. The set is opt in (`--set palateJudge`), at 80 % of
// cases scoring 4 or 5 of 5, and it is kept apart from the deterministic sets: it checks nothing a set of code could, and
// a score here never decides a case of `recipeSuggest`. The judge is given to the factory, so no test calls a model.
// The reasons hold counts only, because a reason is printed and the judge's sentence may name what a draft holds.
import { draftsOf, fail, lastTurnComplete, pass } from "./kitchenGraders.ts";
import {
  RUBRIC_MAXIMUM,
  RUBRIC_PASS_SCORE,
  judgeRequestOf,
  readRubricScore,
} from "./palateJudgeRubric.ts";
import { expectedPalateProfile } from "../fixtures/palateProfile.ts";
import { kitchenWorldHolder } from "../src/kitchenWorld.ts";

import type { EvalCase, Grader } from "../src/case.ts";
import type { Judge } from "../src/judge.ts";
import type { KitchenWorld } from "../src/kitchenWorld.ts";
import type { PalateProfile } from "@keylow/core";

/** Passes when the judge scores the case's draft 4 or 5 of 5. With no draft there is nothing to judge and it fails, with no call. */
export function judgedFit(judge: Judge, profile: () => PalateProfile): Grader {
  return async ({ turns }) => {
    const draft = draftsOf(turns, "suggestion").at(-1);
    if (draft === undefined) {
      return fail("there is no recipe draft to judge");
    }
    const before = judge.tokens();
    const score = readRubricScore(await judge.ask(judgeRequestOf(profile(), draft)));
    const used = judge.tokens() - before;
    const reason = `scored ${score.total} of ${RUBRIC_MAXIMUM} (fit ${score.fit}, variety ${score.variety}, plausible ${score.plausible}${score.avoided ? ", an avoided food" : ""}), the judge used ${used} tokens`;
    return score.total >= RUBRIC_PASS_SCORE ? pass(reason) : fail(reason);
  };
}

const ASKS = [
  "Suggest a dinner around 650 kcal with 45 g protein",
  "Suggest a breakfast around 400 kcal with 30 g protein",
  "Suggest a lunch around 500 kcal with 35 g protein, made from what I usually eat",
  "Suggest a dinner around 600 kcal with 40 g protein that is quick to cook",
  "Suggest a vegetarian dinner around 550 kcal with 30 g protein",
  "Suggest a lunch around 450 kcal with 35 g protein",
] as const;

export function createPalateJudgeCases(world: () => KitchenWorld, judge: Judge): EvalCase[] {
  return ASKS.map((message, index) => ({
    id: `palate-judge-${index + 1}`,
    set: "palateJudge",
    prepare: () => world().ensureWorld(),
    messages: [message],
    expect: [lastTurnComplete(), judgedFit(judge, () => expectedPalateProfile(world().anchorDate))],
  }));
}

export const palateJudgeCases = (judge: Judge): EvalCase[] =>
  createPalateJudgeCases(() => kitchenWorldHolder.current(), judge);
