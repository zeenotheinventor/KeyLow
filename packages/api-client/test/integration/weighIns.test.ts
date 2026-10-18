import { buildManualWeighIn, mapHealthSamples } from "@keylow/core/weight";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import {
  WeighInNotEditableError,
  addWeighIn,
  importWeighIns,
  listWeighIns,
  softDeleteWeighIn,
  updateWeighIn,
} from "../../src/repos/weighIns";

import type { TestUser } from "./support/users";

const RUN_ID = crypto.randomUUID();
const TIME_ZONE = "Europe/London";

const manualWeighIn = (weightKg: number, measuredAt: string, note: string | null = null) =>
  buildManualWeighIn({ weightKg, measuredAt: new Date(measuredAt), note, timeZone: TIME_ZONE });

/** `count` Health samples an hour apart from 2024-01-01 (all at the same instant with `sameInstant`), the nth weighing 20 + n / 10 kg. */
const healthSamples = (count: number, prefix: string, { sameInstant = false } = {}) =>
  mapHealthSamples(
    Array.from({ length: count }, (_, index) => ({
      sampleId: `key362-${prefix}-${RUN_ID}-${index}`,
      measuredAt: new Date(Date.UTC(2024, 0, 1, sameInstant ? 0 : index)).toISOString(),
      value: 20 + index / 10,
      unit: "kilograms" as const,
    })),
    { timeZone: "UTC" },
  ).rows;

const toFixedKg = (weightKg: number) => weightKg.toFixed(1);

describe("weigh-ins against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let userC: TestUser;

  beforeAll(async () => {
    [userA, userB, userC] = await Promise.all([
      createTestUser("key362"),
      createTestUser("key362"),
      createTestUser("key362"),
    ]);
  });

  afterAll(async () => {
    // The users' own weigh-ins go with them (on delete cascade).
    await deleteCreatedTestUsers();
  });

  describe("a manual weigh-in", () => {
    it("should be added, listed, edited and soft deleted, and stay out of another user's list", async () => {
      const added = await addWeighIn(
        userA.client,
        manualWeighIn(81.2, "2026-10-15T07:30:00Z", `key362-note-${RUN_ID}`),
      );
      expect(added).toMatchObject({
        weight_kg: 81.2,
        local_date: "2026-10-15",
        tz: TIME_ZONE,
        source: "manual",
        note: `key362-note-${RUN_ID}`,
      });

      expect(await listWeighIns(userA.client)).toEqual([added]);
      expect(await listWeighIns(userB.client)).toEqual([]);

      const edited = await updateWeighIn(userA.client, added.id, {
        weight_kg: 80.9,
        note: null,
      });
      expect(edited).toEqual({ ...added, weight_kg: 80.9, note: null });
      expect(await listWeighIns(userA.client)).toEqual([edited]);

      await softDeleteWeighIn(userA.client, added.id);
      expect(await listWeighIns(userA.client)).toEqual([]);
    });

    it("should move to another day when its time, date and zone are changed together", async () => {
      const added = await addWeighIn(userB.client, manualWeighIn(70, "2026-10-15T07:30:00Z"));

      const moved = manualWeighIn(70, "2026-10-14T22:30:00Z");
      const edited = await updateWeighIn(userB.client, added.id, {
        measured_at: moved.measured_at,
        local_date: moved.local_date,
        tz: moved.tz,
      });

      expect(edited).toMatchObject({ local_date: "2026-10-14", weight_kg: 70 });
      await softDeleteWeighIn(userB.client, added.id);
    });

    it("should not be editable or deletable by another user", async () => {
      const added = await addWeighIn(userA.client, manualWeighIn(75, "2026-10-16T07:30:00Z"));

      await expect(updateWeighIn(userB.client, added.id, { weight_kg: 60 })).rejects.toThrow(
        WeighInNotEditableError,
      );
      await expect(softDeleteWeighIn(userB.client, added.id)).rejects.toThrow("not found");
      expect(await listWeighIns(userA.client)).toEqual([added]);
      await softDeleteWeighIn(userA.client, added.id);
    });
  });

  describe("the bulk import", () => {
    it("should leave exactly 20 rows after three imports of the same 20 samples", async () => {
      const samples = healthSamples(20, "three");

      const first = await importWeighIns(userA.client, userA.id, samples);
      const second = await importWeighIns(userA.client, userA.id, samples);
      const third = await importWeighIns(userA.client, userA.id, samples);

      expect(first).toEqual({ inserted: 20, skipped: 0 });
      expect(second).toEqual({ inserted: 0, skipped: 20 });
      expect(third).toEqual({ inserted: 0, skipped: 20 });
      const listed = await listWeighIns(userA.client);
      expect(listed.filter(({ source }) => source === "health_connect")).toHaveLength(20);
    });

    it("should not bring a deleted import back", async () => {
      const samples = healthSamples(5, "deleted");
      expect(await importWeighIns(userB.client, userB.id, samples)).toEqual({
        inserted: 5,
        skipped: 0,
      });
      const [victim] = (await listWeighIns(userB.client)).filter(
        ({ source }) => source === "health_connect",
      );
      if (victim === undefined) {
        throw new Error("the import left no row to delete");
      }

      await softDeleteWeighIn(userB.client, victim.id);
      const again = await importWeighIns(userB.client, userB.id, samples);

      expect(again).toEqual({ inserted: 0, skipped: 5 });
      const live = (await listWeighIns(userB.client)).filter(
        ({ source }) => source === "health_connect",
      );
      expect(live).toHaveLength(4);
      expect(live.map(({ id }) => id)).not.toContain(victim.id);
    });

    it("should keep a row for each of two users who import the same sample ids", async () => {
      const samples = healthSamples(3, "shared");

      const forB = await importWeighIns(userB.client, userB.id, samples);
      const forC = await importWeighIns(userC.client, userC.id, samples);

      expect(forB).toEqual({ inserted: 3, skipped: 0 });
      expect(forC).toEqual({ inserted: 3, skipped: 0 });
      expect(await listWeighIns(userC.client)).toHaveLength(3);
    });

    it("should count a sample repeated inside one call as skipped", async () => {
      const [sample] = healthSamples(1, "repeated");
      if (sample === undefined) {
        throw new Error("the fixture has no sample");
      }

      const result = await importWeighIns(userC.client, userC.id, [sample, sample]);

      expect(result).toEqual({ inserted: 1, skipped: 1 });
    });

    it("should refuse rows written for another user, with the code and no weight in the error", async () => {
      const samples = healthSamples(1, "foreign");

      const failure = await importWeighIns(userC.client, userA.id, samples).then(
        () => null,
        (error: unknown) => error,
      );

      expect(failure).toEqual(new Error("Could not import the weigh-ins (42501)"));
    });

    it("should not let an imported row be edited, and let it be deleted", async () => {
      const samples = healthSamples(1, "imported");
      await importWeighIns(userA.client, userA.id, samples);
      const imported = (await listWeighIns(userA.client)).find(
        ({ source, weight_kg }) => source === "health_connect" && weight_kg === 20,
      );
      if (imported === undefined) {
        throw new Error("the import left no row to edit");
      }

      await expect(updateWeighIn(userA.client, imported.id, { weight_kg: 90 })).rejects.toThrow(
        WeighInNotEditableError,
      );
      expect(
        (await listWeighIns(userA.client)).find(({ id }) => id === imported.id)?.weight_kg,
      ).toBe(20);

      await softDeleteWeighIn(userA.client, imported.id);
      expect((await listWeighIns(userA.client)).map(({ id }) => id)).not.toContain(imported.id);
    });
  });

  describe("a user with more rows than one page holds", () => {
    it("should list all 1,100 live rows, newest first, with no duplicate and no gap", async () => {
      const heavy = await createTestUser("key362");
      const samples = healthSamples(1100, "volume");
      await importWeighIns(heavy.client, heavy.id, samples);

      const listed = await listWeighIns(heavy.client);

      expect(listed).toHaveLength(1100);
      expect(new Set(listed.map(({ id }) => id)).size).toBe(1100);
      // The nth sample weighs 20 + n / 10 kg and is the nth hour, so newest first runs from the heaviest down.
      expect(listed.map(({ weight_kg }) => toFixedKg(weight_kg))).toEqual(
        Array.from({ length: 1100 }, (_, position) => toFixedKg(20 + (1099 - position) / 10)),
      );
    });
  });

  describe("rows that share a day and an instant", () => {
    it("should list all 1,100 in id order, which only the id tiebreak of the order puts across pages", async () => {
      const heavy = await createTestUser("key362");
      const samples = healthSamples(1100, "ties", { sameInstant: true });
      await importWeighIns(heavy.client, heavy.id, samples);

      const listed = await listWeighIns(heavy.client);

      expect(listed).toHaveLength(1100);
      expect(new Set(listed.map(({ id }) => id)).size).toBe(1100);
      const ids = listed.map(({ id }) => id);
      expect(ids).toEqual([...ids].sort().reverse());
    });
  });

  describe("an error from the database", () => {
    it("should name the action and the code, and not the weight or the note", async () => {
      const tooLight = { ...manualWeighIn(81.2, "2026-10-17T07:30:00Z"), weight_kg: 19.123 };

      const failure = await addWeighIn(userA.client, {
        ...tooLight,
        note: `key362-note-${RUN_ID}`,
      }).then(
        () => null,
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(Error);
      const text = JSON.stringify(failure, Object.getOwnPropertyNames(failure));
      expect(text).toContain("Could not add the weigh-in (23514)");
      expect(text).not.toContain("19.123");
      expect(text).not.toContain("key362-note");
    });
  });
});
