import { describe, expect, it } from "vitest";

import { buildLogEntry } from "../../src/diary/buildLogEntry";
import { previewAmount } from "../../src/diary/previewAmount";
import {
  SNAPSHOT_PORTION_ID,
  entryPickerChoices,
  snapshotAmountStart,
  snapshotAsFood,
} from "../../src/diary/snapshotAmount";
import { SPOON_PORTIONS } from "../../src/nutrition/volume";
import { buildFood, buildFoodPortion } from "../../src/testing";

import type { Food } from "../../src/schemas/food";

const when = { loggedAt: "2026-10-23T11:40:00+00:00", localDate: "2026-10-23" };

const foods: { name: string; food: Food }[] = [
  { name: "a per 100 g food with a density", food: buildFood({ density_g_per_ml: 0.92 }) },
  { name: "a per 100 ml food", food: buildFood({ basis: "per_100ml", density_g_per_ml: null }) },
];

const medium = buildFoodPortion({ id: "portion-medium", label: "1 medium", grams: 100 });

const labelsOf = (choices: ReturnType<typeof entryPickerChoices>) =>
  choices.options.map((option) => option.label);

// Every row of the rule, for each food and for each spoon: one chip per spoon label, `portions` and
// `options` holding the same ids, and the entry's start unit among the chips.
function expectConsistent(
  snapshot: Parameters<typeof entryPickerChoices>[0],
  live?: Parameters<typeof entryPickerChoices>[1],
) {
  const choices = entryPickerChoices(snapshot, live);
  const values = choices.options.map((option) => option.value);

  for (const spoon of SPOON_PORTIONS) {
    const named = choices.options.filter(
      (option) => option.label.trim().toLowerCase() === spoon.label,
    );
    expect(named.length, `chips named "${spoon.label}"`).toBeLessThanOrEqual(1);
  }
  expect(choices.portions.map((portion) => portion.id).sort()).toEqual(
    values.filter((value) => value !== "g" && value !== "ml").sort(),
  );
  expect(values).toContain(snapshotAmountStart(snapshot).unitValue);

  return choices;
}

describe.each(foods)("entryPickerChoices for $name", ({ food }) => {
  describe.each(SPOON_PORTIONS.map((spoon) => ({ spoon })))(
    "with the $spoon.label spoon",
    ({ spoon }) => {
      const others = SPOON_PORTIONS.filter((candidate) => candidate.id !== spoon.id);
      const [other] = others;
      if (other === undefined) {
        throw new Error("There must be more than one spoon");
      }
      const withoutOther = SPOON_PORTIONS.filter((candidate) => candidate.id !== other.id);
      const stored = buildFoodPortion({
        id: "portion-stored-spoon",
        label: spoon.label,
        grams: 14,
        position: 0,
      });
      const storedOther = buildFoodPortion({
        id: "portion-stored-other",
        label: other.label,
        grams: 5,
        position: 1,
      });
      const inGrams = buildLogEntry({ food, quantity: 30, unit: "g", ...when }).snapshot;
      const inMedium = buildLogEntry({
        food,
        quantity: 2,
        unit: "portion",
        portion: medium,
        ...when,
      }).snapshot;
      const inSpoon = buildLogEntry({
        food,
        quantity: 2,
        unit: "portion",
        portion: spoon,
        ...when,
      }).snapshot;

      it("should keep the stored portion and drop the generated spoon for an entry in grams", () => {
        const choices = expectConsistent(inGrams, { portions: [stored], loggedPortionId: null });

        expect(labelsOf(choices)).toEqual([
          spoon.label,
          "g",
          "ml",
          ...others.map((candidate) => candidate.label),
        ]);
        expect(choices.options[0]?.value).toBe("portion-stored-spoon");
      });

      it("should do the same for an entry in an unrelated portion", () => {
        const choices = expectConsistent(inMedium, {
          portions: [medium, stored],
          loggedPortionId: medium.id,
        });

        expect(choices.options.map((option) => option.value)).toEqual([
          SNAPSHOT_PORTION_ID,
          "portion-stored-spoon",
          "g",
          "ml",
          ...others.map((candidate) => candidate.id),
        ]);
      });

      it("should offer the generated spoon when the food stores no such portion", () => {
        for (const live of [undefined, { portions: [], loggedPortionId: null }]) {
          expect(labelsOf(expectConsistent(inGrams, live))).toEqual([
            "g",
            "ml",
            "1 tsp",
            "1 tbsp",
            "1 cup",
          ]);
        }
      });

      it("should keep an entry logged in the spoon on its spoon and drop the stored portions", () => {
        const heavier = buildFoodPortion({
          id: "portion-heavy",
          label: ` ${spoon.label.toUpperCase()} `,
          grams: 30,
          position: 2,
        });
        const choices = expectConsistent(inSpoon, {
          portions: [stored, heavier],
          loggedPortionId: null,
        });

        expect(labelsOf(choices)).toEqual(["g", "ml", "1 tsp", "1 tbsp", "1 cup"]);
        expect(snapshotAmountStart(inSpoon)).toEqual({ quantity: "2", unitValue: spoon.id });
      });

      it("should open the spoon entry selected with its amount in the hero", () => {
        const { portions } = expectConsistent(inSpoon, {
          portions: [stored],
          loggedPortionId: null,
        });
        const { amount } = previewAmount(snapshotAsFood(inSpoon), portions, spoon.id, "2");

        expect(amount).not.toBeNull();
      });

      it("should treat a stored portion of the spoon's exact size as the spoon", () => {
        const storedInMillilitres = buildFoodPortion({
          id: "portion-stored-ml",
          label: spoon.label,
          grams: null,
          ml: spoon.ml,
        });
        const entry = buildLogEntry({
          food,
          quantity: 2,
          unit: "portion",
          portion: storedInMillilitres,
          ...when,
        }).snapshot;

        const choices = expectConsistent(entry, {
          portions: [storedInMillilitres],
          loggedPortionId: storedInMillilitres.id,
        });

        expect(labelsOf(choices)).toEqual(["g", "ml", "1 tsp", "1 tbsp", "1 cup"]);
        expect(snapshotAmountStart(entry).unitValue).toBe(spoon.id);
      });

      it("should leave a spoon entry as it is when the food stores nothing", () => {
        for (const live of [undefined, { portions: [], loggedPortionId: null }]) {
          expect(labelsOf(expectConsistent(inSpoon, live))).toEqual([
            "g",
            "ml",
            "1 tsp",
            "1 tbsp",
            "1 cup",
          ]);
        }
      });

      it("should keep the entry's spoon and the other spoon's stored portion", () => {
        const choices = expectConsistent(inSpoon, {
          portions: [storedOther],
          loggedPortionId: null,
        });

        expect(choices.options.map((option) => option.value)).toEqual([
          "portion-stored-other",
          "g",
          "ml",
          ...withoutOther.map((candidate) => candidate.id),
        ]);
      });

      describe("an entry in a stored portion that shares the spoon's label but is not the spoon", () => {
        const gramPortion = buildFoodPortion({
          id: "portion-gram-spoon",
          label: spoon.label,
          grams: 14,
          position: 0,
        });
        const entry = buildLogEntry({
          food,
          quantity: 2,
          unit: "portion",
          portion: gramPortion,
          ...when,
        }).snapshot;

        it("should show its own chip in the live portion's place, selected", () => {
          const choices = expectConsistent(entry, {
            portions: [gramPortion, medium],
            loggedPortionId: gramPortion.id,
          });

          expect(choices.options.map((option) => option.value)).toEqual([
            SNAPSHOT_PORTION_ID,
            "portion-medium",
            "g",
            "ml",
            ...others.map((candidate) => candidate.id),
          ]);
          expect(snapshotAmountStart(entry).unitValue).toBe(SNAPSHOT_PORTION_ID);
        });

        it("should do the same for a millilitre portion of another size", () => {
          const odd = buildFoodPortion({
            id: "portion-odd",
            label: spoon.label,
            grams: null,
            ml: spoon.ml + 1,
          });
          const oddEntry = buildLogEntry({
            food,
            quantity: 1,
            unit: "portion",
            portion: odd,
            ...when,
          }).snapshot;

          const choices = expectConsistent(oddEntry, { portions: [odd], loggedPortionId: odd.id });

          expect(choices.options.map((option) => option.value)).toEqual([
            SNAPSHOT_PORTION_ID,
            "g",
            "ml",
            ...others.map((candidate) => candidate.id),
          ]);
        });

        it("should show its own chip first when the food has lost the portion", () => {
          const choices = expectConsistent(entry, { portions: [medium], loggedPortionId: null });

          expect(choices.options.map((option) => option.value)).toEqual([
            SNAPSHOT_PORTION_ID,
            "portion-medium",
            "g",
            "ml",
            ...others.map((candidate) => candidate.id),
          ]);
        });

        it("should show its own chip alone, with the other spoon, when the food is not known", () => {
          const choices = expectConsistent(entry, undefined);

          expect(choices.options.map((option) => option.value)).toEqual([
            SNAPSHOT_PORTION_ID,
            "g",
            "ml",
            ...others.map((candidate) => candidate.id),
          ]);
        });
      });

      describe("an entry whose portion label differs in case and spacing", () => {
        const padded = buildFoodPortion({
          id: "portion-padded",
          label: ` ${spoon.label.toUpperCase()} `.replace(/^ (.)/, "$1"),
          grams: 14,
        });
        const entry = buildLogEntry({
          food,
          quantity: 2,
          unit: "portion",
          portion: padded,
          ...when,
        }).snapshot;

        it("should drop the generated spoon and keep one chip for the replaced live portion", () => {
          const live = buildFoodPortion({ id: "portion-padded", label: spoon.label, grams: 14 });
          const choices = expectConsistent(entry, { portions: [live], loggedPortionId: live.id });

          expect(choices.options.map((option) => option.value)).toEqual([
            SNAPSHOT_PORTION_ID,
            "g",
            "ml",
            ...others.map((candidate) => candidate.id),
          ]);
          expect(snapshotAmountStart(entry).unitValue).toBe(SNAPSHOT_PORTION_ID);
        });

        it("should drop the generated spoon when the food has no such portion", () => {
          const choices = expectConsistent(entry, { portions: [], loggedPortionId: null });

          expect(choices.options.map((option) => option.value)).toEqual([
            SNAPSHOT_PORTION_ID,
            "g",
            "ml",
            ...others.map((candidate) => candidate.id),
          ]);
        });
      });
    },
  );
});

describe("entryPickerChoices with a food that stores one spoon twice", () => {
  it("should keep both stored rows, since the duplicate is in the food's data", () => {
    const food = buildFood({ density_g_per_ml: 0.92 });
    const entry = buildLogEntry({ food, quantity: 30, unit: "g", ...when }).snapshot;
    const first = buildFoodPortion({ id: "portion-a", label: "1 tbsp", grams: 14, position: 0 });
    const second = buildFoodPortion({ id: "portion-b", label: "1 tbsp", grams: 15, position: 1 });

    const choices = entryPickerChoices(entry, { portions: [first, second], loggedPortionId: null });

    expect(choices.options.map((option) => option.value)).toEqual([
      "portion-a",
      "portion-b",
      "g",
      "ml",
      "spoon-tsp",
      "spoon-cup",
    ]);
  });
});

describe("entryPickerChoices for an entry logged in cups", () => {
  it("should open on the cup chip, selected, with an amount of 2", () => {
    const cup = SPOON_PORTIONS.find((spoon) => spoon.id === "spoon-cup");
    if (cup === undefined) {
      throw new Error("The spoon portions must include a cup");
    }
    const food = buildFood({ density_g_per_ml: 0.92 });
    const entry = buildLogEntry({
      food,
      quantity: 2,
      unit: "portion",
      portion: cup,
      ...when,
    }).snapshot;

    const choices = entryPickerChoices(entry);

    expect(snapshotAmountStart(entry)).toEqual({ quantity: "2", unitValue: "spoon-cup" });
    expect(choices.options).toContainEqual({ value: "spoon-cup", label: "1 cup" });
  });
});
