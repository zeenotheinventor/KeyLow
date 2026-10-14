import { afterEach, describe, expect, it, vi } from "vitest";

// Hermes, the JavaScript engine of the mobile app, has no `Intl.ListFormat`. Node does, so
// without this stand-in the copy module can load in tests and still crash the app at launch.
const stubIntlWithoutListFormat = () => {
  vi.stubGlobal("Intl", Object.create(Intl, { ListFormat: { value: undefined } }));
};

describe("the copy module on an engine without Intl.ListFormat", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("should load", async () => {
    vi.resetModules();
    stubIntlWithoutListFormat();

    await expect(import("../../src/copy")).resolves.toHaveProperty("describeMissingValues");
  });

  it("should still join missing nutrient names in British English", async () => {
    vi.resetModules();
    stubIntlWithoutListFormat();

    const { describeMissingValues } = await import("../../src/copy");

    expect(describeMissingValues(["protein_g"], undefined)).toBe(
      "Protein is not given. Fill it in to save your own copy of this food.",
    );
    expect(describeMissingValues(["carbs_g", "kcal"], undefined)).toBe(
      "Energy and carbohydrate are not given. Fill them in to save your own copy of this food.",
    );
    expect(describeMissingValues(["fibre_g", "protein_g", "fat_g"], undefined)).toBe(
      "Protein, fat and fibre are not given. Fill them in to save your own copy of this food.",
    );
  });
});
