import { normaliseOffProduct, type NormaliseOffResult } from "../../src/foods/off";
import badCode from "../fixtures/off/bad-code.json";
import emptyNutriments from "../fixtures/off/empty-nutriments.json";
import kcalPresent from "../fixtures/off/kcal-present.json";
import kjOnly from "../fixtures/off/kj-only.json";
import liquidMl from "../fixtures/off/liquid-ml.json";
import macrosOnly from "../fixtures/off/macros-only.json";
import missingProtein from "../fixtures/off/missing-protein.json";
import noName from "../fixtures/off/no-name.json";
import numericStrings from "../fixtures/off/numeric-strings.json";
import perServingNoQuantity from "../fixtures/off/per-serving-no-quantity.json";
import perServingOnly from "../fixtures/off/per-serving-only.json";
import sodiumNoSalt from "../fixtures/off/sodium-no-salt.json";
import usCarbsNoFibre from "../fixtures/off/us-carbs-no-fibre.json";
import usCarbsWithFibre from "../fixtures/off/us-carbs-with-fibre.json";

/** A fixture payload: any OFF product object that has a `nutriments` record. */
export type OffFixture = Record<string, unknown> & { nutriments: Record<string, unknown> };

export const fixtures = {
  badCode,
  emptyNutriments,
  kcalPresent,
  kjOnly,
  liquidMl,
  macrosOnly,
  missingProtein,
  noName,
  numericStrings,
  perServingNoQuantity,
  perServingOnly,
  sodiumNoSalt,
  usCarbsNoFibre,
  usCarbsWithFibre,
} satisfies Record<string, OffFixture>;

/** The fixtures that normalise successfully, by name. */
export const normalisableFixtures: Record<string, OffFixture> = {
  emptyNutriments,
  kcalPresent,
  kjOnly,
  liquidMl,
  macrosOnly,
  missingProtein,
  numericStrings,
  perServingNoQuantity,
  perServingOnly,
  sodiumNoSalt,
  usCarbsNoFibre,
  usCarbsWithFibre,
};

export function withoutNutriments(fixture: OffFixture, keys: readonly string[]): OffFixture {
  return {
    ...fixture,
    nutriments: Object.fromEntries(
      Object.entries(fixture.nutriments).filter(([key]) => !keys.includes(key)),
    ),
  };
}

export function normaliseOk(raw: unknown): Extract<NormaliseOffResult, { ok: true }> {
  const result = normaliseOffProduct(raw);
  if (!result.ok) {
    throw new Error(`Expected the product to normalise, got ${result.reason}`);
  }
  return result;
}
