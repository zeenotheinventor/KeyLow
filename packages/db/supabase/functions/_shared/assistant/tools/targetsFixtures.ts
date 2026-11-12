// The programme, targets and profile the targets write tool's tests share. Nothing in production imports
// this. All the figures are invented.
import {
  createFakeActionStore,
  createFakeContext,
  turnsOfConversation,
  userId,
} from "../testing.ts";
import { writeContext } from "./writeFixtures.ts";

import type { ReportedFailure } from "../testing.ts";
import type { ToolContext, ToolDefinition } from "../tool.ts";

export const programId = "00000000-0000-4000-8000-0000000a0001";
export const earlier = "00000000-0000-4000-8000-0000000000d1";
export const later = "00000000-0000-4000-8000-0000000000d2";

export const programRow = (overrides: Record<string, unknown> = {}) => ({
  id: programId,
  user_id: userId,
  goal: "lose",
  started_on: "2026-10-22",
  ended_on: null,
  next_checkin_date: "2026-11-06",
  created_at: "2026-10-22T08:00:00+00:00",
  updated_at: "2026-10-29T09:00:00+00:00",
  ...overrides,
});

const engineTargetsRow = {
  user_id: userId,
  program_id: programId,
  effective_from: "2026-10-22",
  effective_to: null,
  calories_kcal: 2140,
  protein_g: 126,
  fat_g: 73,
  carbs_g: 245,
  dow_calories_kcal: [2140, 2140, 2140, 2140, 2140, 2140, 2140],
};

export const profileRow = (overrides: Record<string, unknown> = {}) => ({
  id: userId,
  timezone: "Europe/London",
  target_kcal: 1900,
  target_protein_g: 120,
  target_carbs_g: 200,
  target_fat_g: 60,
  targets_updated_at: "2026-10-22T08:00:00+00:00",
  ...overrides,
});

// All three macros given.
export const newTargets = { kcal: 2000, macros: { protein_g: 150, carbs_g: 200, fat_g: 60 } };

// Only the calories given: the macros are scaled from the targets the person has now.
export const caloriesOnly = { kcal: 2000, macros: null };

// The caller's database with a programme in force, or with `withProgram: false` the manual targets only.
// The earlier turn is where the model asks and the later one where the user has said yes.
export function targetsContexts(
  tools: readonly ToolDefinition[],
  options: {
    withProgram?: boolean;
    profile?: Record<string, unknown>;
    engineTargets?: Record<string, unknown>;
  } = {},
) {
  const withProgram = options.withProgram ?? true;
  const base = writeContext(tools, {
    rows: {
      profiles: [profileRow(options.profile)],
      programs: withProgram ? [programRow()] : [],
      targets: withProgram ? [{ ...engineTargetsRow, ...options.engineTargets }] : [],
    },
  });
  const store = createFakeActionStore({ turns: turnsOfConversation([earlier, later]) });
  const reported: ReportedFailure[] = [];
  const contextOn = (turnId: string): ToolContext => {
    const made = createFakeContext(tools, {
      store,
      // The person pressed the button, so the turn that follows a question is the button's words.
      personsWords: "Change target",
      turn: { id: turnId, conversationId: store.turns[0]?.conversationId ?? "" },
    });
    return {
      ...made.ctx,
      caller: base.stub.caller,
      reportError: (functionName, code, caught) => {
        reported.push({ functionName, code, caught });
      },
    };
  };
  return {
    stub: base.stub,
    store,
    reported,
    asking: contextOn(earlier),
    confirming: contextOn(later),
  };
}
