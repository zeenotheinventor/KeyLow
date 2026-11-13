import { recipeIdOf } from "./kitchenDrafts.ts";

import type { FixtureFood } from "../fixtures/diary.ts";
import type { KitchenWorld } from "../src/kitchenWorld.ts";

/**
 * A kitchen world that touches no database: it records what the cases ask of it and answers fingerprints from a list. A
 * test that needs plans or a list says what they are in `overrides`.
 */
export function fakeKitchenWorld(
  fingerprints: readonly string[] = ["same", "same"],
  overrides: Partial<KitchenWorld> = {},
) {
  const calls: string[] = [];
  let read = 0;
  const world: KitchenWorld = {
    anchorDate: "2026-11-13",
    ensureWorld: () => {
      calls.push("ensureWorld");
      return Promise.resolve();
    },
    recipeIdOf: (name) => Promise.resolve(recipeIdOf(name)),
    recipesFingerprint: () => {
      calls.push("recipesFingerprint");
      const fingerprint = fingerprints[Math.min(read, fingerprints.length - 1)] ?? "";
      read += 1;
      return Promise.resolve(fingerprint);
    },
    markNotUsual: (food: FixtureFood) => {
      calls.push(`markNotUsual ${food}`);
      return Promise.resolve();
    },
    clearCorrections: () => {
      calls.push("clearCorrections");
      return Promise.resolve();
    },
    livePlans: () => Promise.resolve([]),
    confirmDay: (dayId) => {
      calls.push(`confirmDay ${dayId}`);
      return Promise.resolve([]);
    },
    addPlanToList: () => {
      calls.push("addPlanToList");
      return Promise.resolve();
    },
    shoppingList: () => Promise.resolve([]),
    expectedShopping: () => Promise.resolve(new Map()),
    clearPlanning: () => {
      calls.push("clearPlanning");
      return Promise.resolve();
    },
    ...overrides,
  };
  return { world, calls };
}
