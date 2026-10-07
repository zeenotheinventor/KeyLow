import { normaliseBarcode, normaliseOffProduct, offFreshness } from "@keylow/core";
import { describe, expect, it } from "vitest";

import kcalPresent from "../../../../core/test/fixtures/off/kcal-present.json";
import kjOnly from "../../../../core/test/fixtures/off/kj-only.json";
import liquidMl from "../../../../core/test/fixtures/off/liquid-ml.json";
import missingProtein from "../../../../core/test/fixtures/off/missing-protein.json";
import sodiumNoSalt from "../../../../core/test/fixtures/off/sodium-no-salt.json";
import { adminClient } from "../support/stack";

// The five Open Food Facts rows of seeds/20_off_sample.sql, each made from one of core's golden
// fixtures. The seed is plain SQL, so this test reads the rows the seed left in the database and
// compares them with what normaliseOffProduct returns today for the same fixture. A change to a
// fixture or a normaliser rule that the seed does not follow fails here and names the product.
const samples = [
  { barcode: "2000000000015", fixture: kcalPresent },
  { barcode: "2000000000022", fixture: sodiumNoSalt },
  { barcode: "2000000000039", fixture: kjOnly },
  { barcode: "2000000000046", fixture: liquidMl },
  { barcode: "2000000000053", fixture: missingProtein },
];

const loadSeedsMessage =
  "load seeds/20_off_sample.sql as docs/runbooks/local-dev.md says (psql with the seed file)";

// The seed's fetched_at is fixed, so it only reads as fresh for 90 days from when it was written.
// Freshness is therefore judged the day after, never against today's clock.
const theDayAfterTheSeedWasWritten = new Date("2026-10-08T12:00:00Z");

describe.each(samples)("the Open Food Facts sample $barcode", ({ barcode, fixture }) => {
  const raw = { ...fixture, code: barcode };
  const normalised = normaliseOffProduct(raw);

  it("should use a valid EAN-13 barcode in the GS1 restricted circulation range", () => {
    expect(normaliseBarcode(barcode)).toEqual({ ok: true, code: barcode });
    expect(barcode).toMatch(/^2\d{12}$/);
  });

  it("should hold the food the normaliser makes from its fixture", async () => {
    if (!normalised.ok) {
      throw new Error(`The fixture does not normalise: ${normalised.reason}`);
    }

    const { data: food } = await adminClient()
      .from("foods")
      .select("*")
      .eq("source", "off")
      .eq("source_ref", barcode)
      .maybeSingle();

    expect(food, loadSeedsMessage).not.toBeNull();
    expect(food).toMatchObject({
      ...normalised.food,
      source: "off",
      source_ref: barcode,
      owner_id: null,
      deleted_at: null,
    });
    // toMatchObject treats an empty object as matching any object, so these two are compared whole.
    expect(food?.micros).toEqual(normalised.food.micros);
    expect(food?.quality).toEqual(normalised.food.quality);
    expect(food?.fetched_at).not.toBeNull();
    expect(offFreshness(food?.fetched_at ?? "", theDayAfterTheSeedWasWritten)).toBe("fresh");
  });

  it("should keep its fixture as the raw payload", async () => {
    const { data: food } = await adminClient()
      .from("foods")
      .select("id")
      .eq("source", "off")
      .eq("source_ref", barcode)
      .maybeSingle();
    const { data: sourceData } = await adminClient()
      .from("food_source_data")
      .select("raw, import_run_id")
      .eq("food_id", food?.id ?? "")
      .maybeSingle();

    expect(sourceData, loadSeedsMessage).not.toBeNull();
    expect(sourceData?.raw).toEqual(raw);
    expect(sourceData?.import_run_id).toBeNull();
  });

  it("should hold the portions the normaliser makes, as global portions", async () => {
    if (!normalised.ok) {
      throw new Error(`The fixture does not normalise: ${normalised.reason}`);
    }
    const { data: food } = await adminClient()
      .from("foods")
      .select("id")
      .eq("source", "off")
      .eq("source_ref", barcode)
      .maybeSingle();
    const { data: portions } = await adminClient()
      .from("food_portions")
      .select("label, grams, ml, is_default, position, owner_id")
      .eq("food_id", food?.id ?? "")
      .order("position");

    expect(portions).toEqual(
      normalised.portions.map((portion, position) => ({
        label: portion.label,
        grams: portion.grams,
        ml: portion.ml,
        is_default: portion.isDefault,
        position,
        owner_id: null,
      })),
    );
  });
});
