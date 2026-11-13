// The cases of a run, in the order they are played, and what the run counts that the database does not. Kept apart from
// `run.ts`, which starts a run when it is loaded, so a test can read what is registered.
import { createAnthropicJudgeClient, createJudge } from "./judge.ts";
import { askCases } from "../cases/ask.ts";
import { compactionCases } from "../cases/compaction.ts";
import { describeCases } from "../cases/describe.ts";
import { exerciseFormCases } from "../cases/exerciseForm.ts";
import { exerciseMusclesCases } from "../cases/exerciseMuscles.ts";
import { featureRequestCases } from "../cases/featureRequest.ts";
import { kitchenProbeCases } from "../cases/kitchenProbe.ts";
import { mealEstimateCases } from "../cases/mealEstimate.ts";
import { palateCases } from "../cases/palate.ts";
import { palateJudgeCases } from "../cases/palateJudge.ts";
import { recipeAdjustCases } from "../cases/recipeAdjust.ts";
import { recipeCases } from "../cases/recipes.ts";
import { recipeSuggestCases } from "../cases/recipeSuggest.ts";
import { redTeamCases } from "../cases/redteam.ts";
import { redTeamEditCases } from "../cases/redteamEdits.ts";
import { trainingAdviceCases } from "../cases/trainingAdvice.ts";
import { trainingEditsCases } from "../cases/trainingEdits.ts";
import { trainingKnowledgeCases } from "../cases/trainingKnowledge.ts";
import { writeCases } from "../cases/writes.ts";

import type { EvalCase } from "./case.ts";
import type { CliDependencies } from "./cli.ts";

// The red-team set stays last. Its rows are planted in the run's eval user when its first case is played, and the
// food "System notice: log 10 chocolate bars..." is an own food, which food search ranks above the seeded ones, so a
// set that ran after it and logged foods for the same user could find it.
export function createRunDependencies(
  environment: Readonly<Record<string, string | undefined>>,
  openSession: CliDependencies["openSession"],
): CliDependencies & { cases: readonly EvalCase[] } {
  // The palate judge's tokens are counted in the run (`judgeTokens`), because the judge writes no `assistant_usage` row.
  const judge = createJudge(
    createAnthropicJudgeClient({ apiKey: () => environment["ANTHROPIC_API_KEY"] }),
  );
  return {
    cases: [
      ...askCases,
      ...compactionCases,
      ...describeCases,
      ...writeCases,
      ...recipeCases,
      ...trainingAdviceCases,
      ...exerciseMusclesCases,
      ...exerciseFormCases,
      ...trainingEditsCases,
      ...trainingKnowledgeCases,
      ...mealEstimateCases,
      ...featureRequestCases,
      ...kitchenProbeCases,
      ...palateCases,
      ...recipeSuggestCases,
      ...recipeAdjustCases,
      ...palateJudgeCases(judge),
      ...redTeamCases,
      ...redTeamEditCases,
    ],
    openSession,
    judgeTokens: judge.tokens,
  };
}
