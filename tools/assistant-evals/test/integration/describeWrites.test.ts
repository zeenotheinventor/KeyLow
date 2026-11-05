import { describe, expect, it } from "vitest";

import { adminClient } from "../../../../packages/db/test/integration/support/stack";
import { scratchDayOf, writeCasesOf } from "../../cases/writes.ts";
import { ASK_TARGETS } from "../../fixtures/askExtras.ts";
import { SEEDED_FOODS } from "../../fixtures/describeExtras.ts";
import { openLocalHttpSession } from "../../src/httpSession.ts";

// These need the local stack with its seeds. They read the seeded foods and the eval user's own view, and
// write only through the eval user's session, which is removed at the end.

describe("the seeded foods the describe and write sets expect", () => {
  it.each(SEEDED_FOODS.map(({ code }) => code))(
    "should be in the local database with the name and the portions of the fixture for %s",
    async (code) => {
      const client = adminClient();
      const held = SEEDED_FOODS.find((candidate) => candidate.code === code);
      const { data: foods, error } = await client
        .from("foods")
        .select("id,name")
        .eq("source", "cofid")
        .eq("source_ref", code);
      expect(error).toBeNull();
      expect(foods).toHaveLength(1);

      const { data: portions } = await client
        .from("food_portions")
        .select("label,grams,is_default,position")
        .eq("food_id", foods?.[0]?.id ?? "")
        .is("owner_id", null)
        .order("position");

      expect(foods?.[0]?.name).toBe(held?.name);
      expect(
        portions?.map(({ label, grams, is_default }) => ({
          label,
          grams: Number(grams),
          isDefault: is_default,
        })),
      ).toEqual(held?.portions);
    },
  );
});

describe("the eval session for the write set", () => {
  it("should put the targets back to the ask targets, and leave the scratch days empty", async () => {
    const session = await openLocalHttpSession();
    try {
      const today = new Date().toISOString().slice(0, 10);
      const environment = session.environment;
      expect(environment).toBeDefined();

      await environment?.restoreTargets();

      expect(
        await session.database.countRows({
          table: "profiles",
          where: {
            target_kcal: ASK_TARGETS.kcal,
            target_protein_g: ASK_TARGETS.protein_g,
            target_carbs_g: ASK_TARGETS.carbs_g,
            target_fat_g: ASK_TARGETS.fat_g,
          },
        }),
      ).toBe(1);
      for (const evalCase of writeCasesOf(today)) {
        expect(evalCase.set).toBe("writes");
      }
      for (const k of [1, 15]) {
        expect(
          await session.database.countRows({
            table: "food_log_entries",
            where: { local_date: scratchDayOf(today, k) },
          }),
        ).toBe(0);
      }
    } finally {
      await session.close();
    }
  });

  it("should answer no outcomes when Undo is pressed for a turn that wrote nothing", async () => {
    const session = await openLocalHttpSession();
    try {
      const outcomes = await session.environment?.undoTurn(crypto.randomUUID());

      expect(outcomes).toEqual([]);
    } finally {
      await session.close();
    }
  });
});
