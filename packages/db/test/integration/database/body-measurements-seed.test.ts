import { beforeAll, describe, expect, it } from "vitest";

import { anonClient } from "../support/stack";

// The body composition screens read the demo user's readings from the seed
// (supabase/seeds/41_body_measurements.sql). This signs in as that user, as the app does, and checks
// the facts the screen tickets rely on: a drift in both kinds, a gap, a day with two body fat
// readings, one deleted import, and enough recent readings of each kind to be settled. The dates are
// relative to today, so it also fails when the seed was loaded on an earlier day. Loading it again
// moves the same rows to today.
const loadSeedMessage =
  "load seeds/41_body_measurements.sql as docs/runbooks/local-dev.md says (psql with the seed file)";

// The demo user from supabase/seed.sql, a local test account that never reaches production.
const demoEmail = "demo@keylow.local";
const demoPassword = "keylow-demo-local";

const gapDaysAgo = [12, 13, 14, 15, 16];
const windowDays = 42;
const settledReadingCount = 7;
const recentWindowDays = 14;

type BodyMeasurementKind = "body_fat_pct" | "lean_mass_kg";

type SeededMeasurement = {
  kind: BodyMeasurementKind;
  local_date: string;
  tz: string;
  value: number;
  source: string;
  external_id: string | null;
  deleted_at: string | null;
};

let measurements: SeededMeasurement[] = [];
let today = "";

const daysAgo = (days: number): string => {
  const [year = 0, month = 1, day = 1] = today.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10);
};

const liveOfKind = (kind: BodyMeasurementKind): SeededMeasurement[] =>
  measurements.filter((row) => row.kind === kind && row.deleted_at === null);

const datesOf = (rows: SeededMeasurement[]): Set<string> =>
  new Set(rows.map((row) => row.local_date));

const valueOnOldestDay = (rows: SeededMeasurement[]): number | undefined =>
  [...rows].sort((a, b) => a.local_date.localeCompare(b.local_date))[0]?.value;

const valueOnNewestDay = (rows: SeededMeasurement[]): number | undefined =>
  [...rows].sort((a, b) => b.local_date.localeCompare(a.local_date))[0]?.value;

const kinds: BodyMeasurementKind[] = ["body_fat_pct", "lean_mass_kg"];

beforeAll(async () => {
  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email: demoEmail,
    password: demoPassword,
  });
  if (signInError) {
    throw new Error("Could not sign in as the demo user from seed.sql", { cause: signInError });
  }

  const { data, error } = await client
    .from("body_measurements")
    .select("kind, local_date, tz, value, source, external_id, deleted_at");
  expect(error).toBeNull();
  measurements = data ?? [];

  // Today in the zone the seed stored, which is the demo profile's zone.
  const zone = measurements[0]?.tz ?? "UTC";
  today = new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(new Date());
});

describe("the demo user's seeded body measurements", () => {
  it.each(kinds)("should hold at least 20 live %s readings", (kind) => {
    expect(liveOfKind(kind).length, loadSeedMessage).toBeGreaterThanOrEqual(20);
  });

  it.each(kinds)("should end today for %s, so the chart's ranges have data", (kind) => {
    const latestDate = [...datesOf(liveOfKind(kind))].sort().at(-1);

    expect(latestDate, loadSeedMessage).toBe(today);
  });

  it("should drift body fat from about 22.8 to about 22.0", () => {
    const body = liveOfKind("body_fat_pct");

    expect(valueOnOldestDay(body) ?? 0, loadSeedMessage).toBeGreaterThan(
      valueOnNewestDay(body) ?? Infinity,
    );
    expect(valueOnOldestDay(body), loadSeedMessage).toBeCloseTo(22.8, 0);
    expect(valueOnNewestDay(body), loadSeedMessage).toBeCloseTo(22.0, 0);
    expect(Math.max(...body.map((row) => row.value)), loadSeedMessage).toBeLessThan(23.2);
    expect(Math.min(...body.map((row) => row.value)), loadSeedMessage).toBeGreaterThan(21.8);
  });

  it("should drift lean mass from about 65.6 to about 65.2 kg", () => {
    const lean = liveOfKind("lean_mass_kg");

    expect(valueOnOldestDay(lean) ?? 0, loadSeedMessage).toBeGreaterThan(
      valueOnNewestDay(lean) ?? Infinity,
    );
    expect(valueOnOldestDay(lean), loadSeedMessage).toBeCloseTo(65.6, 0);
    expect(valueOnNewestDay(lean), loadSeedMessage).toBeCloseTo(65.2, 0);
    expect(Math.max(...lean.map((row) => row.value)), loadSeedMessage).toBeLessThan(66);
    expect(Math.min(...lean.map((row) => row.value)), loadSeedMessage).toBeGreaterThan(64.8);
  });

  it.each(kinds)("should hold %s readings on about two days in three", (kind) => {
    const daysWithReading = Array.from({ length: windowDays }, (_, days) => days).filter((days) =>
      datesOf(liveOfKind(kind)).has(daysAgo(days)),
    );

    expect(daysWithReading.length / windowDays, loadSeedMessage).toBeGreaterThan(0.5);
    expect(daysWithReading.length / windowDays, loadSeedMessage).toBeLessThan(0.75);
  });

  it.each(kinds)(
    "should hold a gap of five days with no %s reading, with readings on both sides",
    (kind) => {
      const liveDates = datesOf(liveOfKind(kind));

      expect(
        gapDaysAgo.filter((days) => liveDates.has(daysAgo(days))),
        loadSeedMessage,
      ).toEqual([]);
      expect(liveDates.has(daysAgo(Math.min(...gapDaysAgo) - 1)), loadSeedMessage).toBe(true);
      expect(liveDates.has(daysAgo(Math.max(...gapDaysAgo) + 1)), loadSeedMessage).toBe(true);
    },
  );

  it("should hold one day with two body fat readings and none with two lean mass readings", () => {
    const daysWithTwoReadings = (kind: BodyMeasurementKind): number => {
      const readingsPerDate = new Map<string, number>();
      for (const row of liveOfKind(kind)) {
        readingsPerDate.set(row.local_date, (readingsPerDate.get(row.local_date) ?? 0) + 1);
      }
      return [...readingsPerDate.values()].filter((count) => count === 2).length;
    };

    expect(daysWithTwoReadings("body_fat_pct"), loadSeedMessage).toBe(1);
    expect(daysWithTwoReadings("lean_mass_kg"), loadSeedMessage).toBe(0);
  });

  it("should import every reading from Health Connect with a seed external id of its kind", () => {
    const prefixes: Record<BodyMeasurementKind, string> = {
      body_fat_pct: "seed-hc-bf-",
      lean_mass_kg: "seed-hc-lm-",
    };

    for (const kind of kinds) {
      const rows = measurements.filter((row) => row.kind === kind);

      expect(rows.length, loadSeedMessage).toBeGreaterThan(0);
      expect(
        rows.every(
          (row) =>
            row.source === "health_connect" && row.external_id?.startsWith(prefixes[kind]) === true,
        ),
        loadSeedMessage,
      ).toBe(true);
    }
  });

  it("should hold one soft-deleted body fat import that keeps its import key", () => {
    const deleted = measurements.filter((row) => row.deleted_at !== null);

    expect(
      deleted.map((row) => [row.kind, row.source, row.external_id]),
      loadSeedMessage,
    ).toEqual([["body_fat_pct", "health_connect", "seed-hc-bf-deleted"]]);
  });

  it.each(kinds)("should hold enough %s readings in the last 14 days to be settled", (kind) => {
    const windowStart = daysAgo(recentWindowDays - 1);
    const recentReadings = liveOfKind(kind).filter((row) => row.local_date >= windowStart);

    expect(recentReadings.length, loadSeedMessage).toBeGreaterThanOrEqual(settledReadingCount);
  });

  it("should keep every value inside the bounds of its kind", () => {
    for (const row of measurements) {
      const [low, high] = row.kind === "body_fat_pct" ? [1, 75] : [10, 300];

      expect(row.value >= low && row.value <= high, loadSeedMessage).toBe(true);
    }
  });
});
