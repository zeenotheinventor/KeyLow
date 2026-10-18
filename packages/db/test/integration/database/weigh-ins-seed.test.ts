import { computeTrend } from "@keylow/core";
import { beforeAll, describe, expect, it } from "vitest";

import { anonClient } from "../support/stack";

// The weight screen reads the demo user's weigh-ins from the seed (supabase/seeds/40_weigh_ins.sql).
// This signs in as that user, as the app does, and checks the facts the screen tickets rely on: a
// spike, a gap, a day with two readings, one deleted import, and enough recent readings to be
// settled. The dates are relative to today, so it also fails when the seed was loaded on an earlier
// day. Loading it again moves the same rows to today.
const loadSeedMessage =
  "load seeds/40_weigh_ins.sql as docs/runbooks/local-dev.md says (psql with the seed file)";

// The demo user from supabase/seed.sql, a local test account that never reaches production.
const demoEmail = "demo@keylow.local";
const demoPassword = "keylow-demo-local";

const spikeKg = 99;
const spikeDaysAgo = 6;
const gapDaysAgo = [12, 13, 14, 15, 16];
const settledReadingCount = 7;

type SeededWeighIn = {
  local_date: string;
  tz: string;
  weight_kg: number;
  source: string;
  external_id: string | null;
  deleted_at: string | null;
};

let weighIns: SeededWeighIn[] = [];
let today = "";

const daysAgo = (days: number): string => {
  const [year = 0, month = 1, day = 1] = today.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10);
};

const liveWeighIns = (): SeededWeighIn[] => weighIns.filter((row) => row.deleted_at === null);

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
    .from("weigh_ins")
    .select("local_date, tz, weight_kg, source, external_id, deleted_at");
  expect(error).toBeNull();
  weighIns = data ?? [];

  // Today in the zone the seed stored, which is the demo profile's zone.
  const zone = weighIns[0]?.tz ?? "UTC";
  today = new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(new Date());
});

describe("the demo user's seeded weigh-ins", () => {
  it("should hold at least 30 live weigh-ins", () => {
    expect(liveWeighIns().length, loadSeedMessage).toBeGreaterThanOrEqual(30);
  });

  it("should end today, so the chart's ranges have data", () => {
    const latestDate = liveWeighIns()
      .map((row) => row.local_date)
      .sort()
      .at(-1);

    expect(latestDate, loadSeedMessage).toBe(today);
  });

  it("should hold the spike that computeTrend rejects", () => {
    const spikes = liveWeighIns().filter((row) => row.weight_kg === spikeKg);

    expect(
      spikes.map((row) => row.local_date),
      loadSeedMessage,
    ).toEqual([daysAgo(spikeDaysAgo)]);
  });

  it("should hold a gap of five days with no weigh-in, with readings on both sides", () => {
    const liveDates = new Set(liveWeighIns().map((row) => row.local_date));

    expect(
      gapDaysAgo.filter((days) => liveDates.has(daysAgo(days))),
      loadSeedMessage,
    ).toEqual([]);
    expect(liveDates.has(daysAgo(Math.min(...gapDaysAgo) - 1)), loadSeedMessage).toBe(true);
    expect(liveDates.has(daysAgo(Math.max(...gapDaysAgo) + 1)), loadSeedMessage).toBe(true);
  });

  it("should hold one day with two readings", () => {
    const readingsPerDate = new Map<string, number>();
    for (const row of liveWeighIns()) {
      readingsPerDate.set(row.local_date, (readingsPerDate.get(row.local_date) ?? 0) + 1);
    }
    const doubleDays = [...readingsPerDate.values()].filter((count) => count === 2);

    expect(doubleDays.length, loadSeedMessage).toBe(1);
  });

  it("should hold about one imported reading in three", () => {
    const live = liveWeighIns();
    const imported = live.filter((row) => row.source === "health_connect");

    expect(imported.length / live.length, loadSeedMessage).toBeGreaterThan(0.25);
    expect(imported.length / live.length, loadSeedMessage).toBeLessThan(0.4);
    expect(
      imported.every((row) => row.external_id?.startsWith("seed-hc-")),
      loadSeedMessage,
    ).toBe(true);
  });

  it("should hold one soft-deleted imported row that keeps its import key", () => {
    const deleted = weighIns.filter((row) => row.deleted_at !== null);

    expect(
      deleted.map((row) => [row.source, row.external_id]),
      loadSeedMessage,
    ).toEqual([["health_connect", "seed-hc-deleted"]]);
  });

  it("should hold enough accepted readings in the last 14 days to be settled", () => {
    const windowStart = daysAgo(13);
    const acceptedRecentDates = new Set(
      liveWeighIns()
        .filter((row) => row.local_date >= windowStart && row.weight_kg !== spikeKg)
        .map((row) => row.local_date),
    );

    expect(acceptedRecentDates.size, loadSeedMessage).toBeGreaterThanOrEqual(settledReadingCount);
  });

  it("should give the engine a rejected spike, interpolated gap days and a settled last point", () => {
    // The facts above are what the seed was written to show. This checks that the real engine
    // agrees, so a later change to its parameters cannot silently break what the seed is for.
    const points = computeTrend(
      liveWeighIns().map((row) => ({ localDate: row.local_date, weightKg: row.weight_kg })),
    );
    const pointOn = (date: string) => points.find((point) => point.date === date);

    expect(pointOn(daysAgo(spikeDaysAgo))?.rejected, loadSeedMessage).toBe(true);
    expect(
      gapDaysAgo.map((days) => pointOn(daysAgo(days))?.interpolated),
      loadSeedMessage,
    ).toEqual(gapDaysAgo.map(() => true));
    expect(points.at(-1)?.nObs ?? 0, loadSeedMessage).toBeGreaterThanOrEqual(settledReadingCount);
  });
});
