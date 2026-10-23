import { mapHealthBodyFatSamples, mapHealthLeanMassSamples } from "@keylow/core/weight";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { importBodyMeasurements, listBodyMeasurements } from "../../src/repos/bodyMeasurements";

import type { TestUser } from "./support/users";

const RUN_ID = crypto.randomUUID();
const TIME_ZONE = "UTC";
const HOUR_MS = 3_600_000;

const instantOf = (index: number) => new Date(Date.UTC(2024, 0, 1) + index * HOUR_MS).toISOString();

/** `count` body fat readings an hour apart from 2024-01-01, the nth at 10 + n / 10 per cent. */
const bodyFatRows = (count: number, prefix: string) =>
  mapHealthBodyFatSamples(
    Array.from({ length: count }, (_, index) => ({
      sampleId: `key571-${prefix}-${RUN_ID}-${index}`,
      measuredAt: instantOf(index),
      value: 10 + index / 10,
    })),
    { timeZone: TIME_ZONE },
  ).rows;

/** `count` lean mass readings an hour apart from 2024-01-01, the nth at 40 + n / 10 kilograms. */
const leanMassRows = (count: number, prefix: string) =>
  mapHealthLeanMassSamples(
    Array.from({ length: count }, (_, index) => ({
      sampleId: `key571-${prefix}-${RUN_ID}-${index}`,
      measuredAt: instantOf(index),
      value: 40 + index / 10,
      unit: "kilograms" as const,
    })),
    { timeZone: TIME_ZONE },
  ).rows;

const toFixedValue = (value: number) => value.toFixed(1);

const failureOf = (call: Promise<unknown>) =>
  call.then(
    () => null,
    (error: unknown) => error,
  );

describe("body measurements against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let userC: TestUser;

  beforeAll(async () => {
    [userA, userB, userC] = await Promise.all([
      createTestUser("key571"),
      createTestUser("key571"),
      createTestUser("key571"),
    ]);
  });

  afterAll(async () => {
    // The users' own measurements go with them (on delete cascade).
    await deleteCreatedTestUsers();
  });

  describe("the bulk import", () => {
    it("should leave exactly 20 rows after three imports of the same 20 mixed-kind readings", async () => {
      const rows = [...bodyFatRows(10, "three-fat"), ...leanMassRows(10, "three-lean")];

      const first = await importBodyMeasurements(userA.client, userA.id, rows);
      const second = await importBodyMeasurements(userA.client, userA.id, rows);
      const third = await importBodyMeasurements(userA.client, userA.id, rows);

      expect(first).toEqual({ inserted: 20, skipped: 0 });
      expect(second).toEqual({ inserted: 0, skipped: 20 });
      expect(third).toEqual({ inserted: 0, skipped: 20 });
      const bodyFat = await listBodyMeasurements(userA.client, "body_fat_pct");
      const leanMass = await listBodyMeasurements(userA.client, "lean_mass_kg");
      expect(bodyFat).toHaveLength(10);
      expect(leanMass).toHaveLength(10);
    });

    it("should not bring a soft-deleted reading back, restore it or recreate it", async () => {
      const rows = bodyFatRows(5, "deleted");
      expect(await importBodyMeasurements(userB.client, userB.id, rows)).toEqual({
        inserted: 5,
        skipped: 0,
      });
      const [victim] = await listBodyMeasurements(userB.client, "body_fat_pct");
      if (victim === undefined) {
        throw new Error("the import left no row to delete");
      }
      // The owner's own `update deleted_at`, which is all the update grant allows.
      const deletion = await userB.client
        .from("body_measurements")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", victim.id);
      expect(deletion.error).toBeNull();
      expect(await listBodyMeasurements(userB.client, "body_fat_pct")).toHaveLength(4);

      const again = await importBodyMeasurements(userB.client, userB.id, rows);

      expect(again).toEqual({ inserted: 0, skipped: 5 });
      const live = await listBodyMeasurements(userB.client, "body_fat_pct");
      expect(live.map(({ id }) => id)).not.toContain(victim.id);
      expect(live).toHaveLength(4);
      const stored = await userB.client
        .from("body_measurements")
        .select("id,deleted_at")
        .eq("kind", "body_fat_pct");
      expect(stored.data).toHaveLength(5);
      expect(stored.data?.find(({ id }) => id === victim.id)?.deleted_at).not.toBeNull();
    });

    it("should store the same sample id under the other kind, because the key includes the kind", async () => {
      const [fat] = mapHealthBodyFatSamples(
        [{ sampleId: `key571-shared-${RUN_ID}`, measuredAt: instantOf(0), value: 22 }],
        { timeZone: TIME_ZONE },
      ).rows;
      const [lean] = mapHealthLeanMassSamples(
        [
          {
            sampleId: `key571-shared-${RUN_ID}`,
            measuredAt: instantOf(0),
            value: 60,
            unit: "kilograms",
          },
        ],
        { timeZone: TIME_ZONE },
      ).rows;
      if (fat === undefined || lean === undefined) {
        throw new Error("the fixture has no row");
      }

      const result = await importBodyMeasurements(userC.client, userC.id, [fat, lean]);

      expect(result).toEqual({ inserted: 2, skipped: 0 });
      expect(await listBodyMeasurements(userC.client, "body_fat_pct")).toMatchObject([
        { kind: "body_fat_pct", value: 22 },
      ]);
      expect(await listBodyMeasurements(userC.client, "lean_mass_kg")).toMatchObject([
        { kind: "lean_mass_kg", value: 60 },
      ]);
    });
  });

  describe("owner only", () => {
    it("should not list another user's readings", async () => {
      const owner = await createTestUser("key571");
      const stranger = await createTestUser("key571");
      await importBodyMeasurements(owner.client, owner.id, [
        ...bodyFatRows(3, "owner-fat"),
        ...leanMassRows(2, "owner-lean"),
      ]);

      expect(await listBodyMeasurements(owner.client, "body_fat_pct")).toHaveLength(3);
      expect(await listBodyMeasurements(owner.client, "lean_mass_kg")).toHaveLength(2);
      expect(await listBodyMeasurements(stranger.client, "body_fat_pct")).toEqual([]);
      expect(await listBodyMeasurements(stranger.client, "lean_mass_kg")).toEqual([]);
    });

    it("should refuse an import under another user's id and write nothing", async () => {
      const victim = await createTestUser("key571");
      const intruder = await createTestUser("key571");

      const failure = await failureOf(
        importBodyMeasurements(intruder.client, victim.id, bodyFatRows(1, "foreign")),
      );

      expect(failure).toEqual(new Error("Could not import the body measurements (42501)"));
      expect(await listBodyMeasurements(victim.client, "body_fat_pct")).toEqual([]);
    });
  });

  describe("a user with more readings than one page holds", () => {
    it("should list all 1,100 live rows of one kind, newest first, with no duplicate, no gap and no other kind", async () => {
      const heavy = await createTestUser("key571");
      await importBodyMeasurements(heavy.client, heavy.id, [
        ...leanMassRows(1100, "volume-lean"),
        ...bodyFatRows(20, "volume-fat"),
      ]);

      const listed = await listBodyMeasurements(heavy.client, "lean_mass_kg");

      expect(listed).toHaveLength(1100);
      expect(new Set(listed.map(({ id }) => id)).size).toBe(1100);
      expect(listed.every(({ kind }) => kind === "lean_mass_kg")).toBe(true);
      // The nth reading is the nth hour and weighs 40 + n / 10, so newest first runs from the heaviest down.
      expect(listed.map(({ value }) => toFixedValue(value))).toEqual(
        Array.from({ length: 1100 }, (_, position) => toFixedValue(40 + (1099 - position) / 10)),
      );
      expect(await listBodyMeasurements(heavy.client, "body_fat_pct")).toHaveLength(20);
    });

    it("should list 1,100 rows that share a day and an instant in id order, which only the id tiebreak puts across pages", async () => {
      const heavy = await createTestUser("key571");
      const sameInstant = mapHealthLeanMassSamples(
        Array.from({ length: 1100 }, (_, index) => ({
          sampleId: `key571-ties-${RUN_ID}-${index}`,
          measuredAt: instantOf(0),
          value: 40 + index / 10,
          unit: "kilograms" as const,
        })),
        { timeZone: TIME_ZONE },
      ).rows;
      await importBodyMeasurements(heavy.client, heavy.id, sameInstant);

      const listed = await listBodyMeasurements(heavy.client, "lean_mass_kg");

      expect(listed).toHaveLength(1100);
      expect(new Set(listed.map(({ id }) => id)).size).toBe(1100);
      const ids = listed.map(({ id }) => id);
      expect(ids).toEqual([...ids].sort().reverse());
    });
  });

  describe("an error from the database", () => {
    it("should name the action and the code, and not the value or the sample id", async () => {
      const [good] = bodyFatRows(1, "error");
      if (good === undefined) {
        throw new Error("the fixture has no row");
      }
      // A body fat of 80.123 is outside the table's check, which core would have skipped before the send.
      const failure = await failureOf(
        importBodyMeasurements(userA.client, userA.id, [{ ...good, value: 80.123 }]),
      );

      expect(failure).toBeInstanceOf(Error);
      const text = JSON.stringify(failure, Object.getOwnPropertyNames(failure));
      expect(text).toContain("Could not import the body measurements (23514)");
      expect(text).not.toContain("80.123");
      expect(text).not.toContain("key571-error");
    });
  });
});
