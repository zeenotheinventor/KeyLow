import { recipeIdOf } from "./kitchenDrafts.ts";

import type { FixtureFood } from "../fixtures/diary.ts";
import type { KitchenWorld } from "../src/kitchenWorld.ts";

/** A kitchen world that touches no database: it records what the cases ask of it and answers fingerprints from a list. */
export function fakeKitchenWorld(fingerprints: readonly string[] = ["same", "same"]) {
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
  };
  return { world, calls };
}
