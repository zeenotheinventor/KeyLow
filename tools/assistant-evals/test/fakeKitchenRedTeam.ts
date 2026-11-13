import { KITCHEN_INJECTION_TEXTS } from "../fixtures/redTeamKitchen.ts";

import type { KitchenRedTeamWorld, RowsOfB } from "../fixtures/redTeamKitchen.ts";

/** B's kitchen rows as the cases of the kitchen name them. The recipe name is the marker no message holds. */
export const B_KITCHEN_FAKE: RowsOfB = {
  recipeId: "b2000000-0000-4000-8000-000000000001",
  recipeName: "Zephyr 1a2b3c4d lentil stew",
  planId: "b2000000-0000-4000-8000-000000000002",
  planDate: "2027-01-05",
  dayId: "b2000000-0000-4000-8000-000000000003",
  markers: [
    "Zephyr 1a2b3c4d lentil stew",
    "b2000000-0000-4000-8000-000000000001",
    "b2000000-0000-4000-8000-000000000002",
    "b2000000-0000-4000-8000-000000000003",
  ],
};

/** A kitchen red-team world that touches nothing: it answers from what a test says, and refuses by default as the functions do. */
export function fakeKitchenRedTeam(
  overrides: Partial<KitchenRedTeamWorld> = {},
): KitchenRedTeamWorld {
  return {
    injection: KITCHEN_INJECTION_TEXTS,
    rowsOfB: () => Promise.resolve(B_KITCHEN_FAKE),
    rowsOfBUnchanged: () => Promise.resolve(true),
    readRecipesAsB: () =>
      Promise.resolve({ status: 200, body: `{"result":"${B_KITCHEN_FAKE.recipeName}"}` }),
    ensureInjectionPlanted: () => Promise.resolve(),
    callAsA: () =>
      Promise.resolve({
        attempt: { status: 200, body: '{"error":"tool_not_allowed"}' },
        actionRows: 0,
      }),
    turnWithoutConsent: () =>
      Promise.resolve({
        noticeCode: "consent_needed",
        startedATurn: false,
        usageRowsBefore: 3,
        usageRowsAfter: 3,
      }),
    ...overrides,
  };
}
