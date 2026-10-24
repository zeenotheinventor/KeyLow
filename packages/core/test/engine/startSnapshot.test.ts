import { describe, expect, it } from "vitest";

import {
  DEFAULT_ENGINE_PARAMS,
  profileBmr,
  requireStats,
  startSnapshot,
  startSnapshotAction,
} from "../../src/engine";

import type { EngineParams, ProfileStats } from "../../src/engine";

/*
 * Every expected figure is a literal. The Build Plan's person is a man of 35, 80 kg, 180 cm, `light`:
 * BMR is 10 * 80 + 6.25 * 180 - 5 * 35 + 5 = 1755, times 1.375 is 2413.125, and the prior variance is
 * (0.15 * 2413.125)^2 = 131021.376. They were worked out by hand, not by the module.
 */

const BUILD_PLAN_STATS: ProfileStats = {
  sex: "male",
  birthDate: "1991-03-15",
  heightCm: 180,
  activity: "light",
};

/** Params that differ from the defaults where a test needs to see them read. */
const CUSTOM_PARAMS: EngineParams = {
  ...DEFAULT_ENGINE_PARAMS,
  // The version is typed as the one literal, so a different one is a deliberate type error here.
  // @ts-expect-error a runtime check that the version is read from the params it is given
  version: "keylow-engine-test",
  expenditure: {
    ...DEFAULT_ENGINE_PARAMS.expenditure,
    sexOffsetKcal: { male: 100, female: -161, other: -78 },
    activityFactors: { ...DEFAULT_ENGINE_PARAMS.expenditure.activityFactors, light: 1.5 },
    priorCv: 0.2,
  },
};

describe("profileBmr", () => {
  it("should give 1755 for the Build Plan's man of 35, 80 kg, 180 cm", () => {
    expect(profileBmr(BUILD_PLAN_STATS, 80, "2026-10-22")).toBe(1755);
  });

  it("should use the age on the day asked for, 5 kcal lower the day before the birthday", () => {
    const stats: ProfileStats = { ...BUILD_PLAN_STATS, birthDate: "1991-10-23" };

    expect(profileBmr(stats, 80, "2026-10-22")).toBe(1760);
    expect(profileBmr(stats, 80, "2026-10-23")).toBe(1755);
  });

  it("should read the offset of the sex from the params: 100 for a man gives 1850", () => {
    expect(profileBmr(BUILD_PLAN_STATS, 80, "2026-10-22", CUSTOM_PARAMS)).toBe(1850);
  });

  it("should use the weight it is given and the offset of the sex", () => {
    expect(profileBmr({ ...BUILD_PLAN_STATS, sex: "female" }, 70, "2026-10-22")).toBe(1489);
  });
});

describe("requireStats (ADR 0002, Amendment 2, 'The prior for an account with no stats')", () => {
  const complete = {
    sex: "male",
    birth_date: "1991-03-15",
    height_cm: 180,
    activity: "light",
    onboarding_weight_kg: 80,
  };

  it("should return the stats and the onboarding weight of a complete profile", () => {
    expect(requireStats(complete)).toStrictEqual({
      ok: true,
      stats: BUILD_PLAN_STATS,
      onboardingWeightKg: 80,
    });
  });

  it.each(["2026-02-30", "1991-13-01", "not a date", "15/03/1991", ""])(
    "should answer missing_stats for a birth date that is not a calendar day (%j)",
    (birthDate) => {
      expect(requireStats({ ...complete, birth_date: birthDate })).toStrictEqual({
        ok: false,
        reason: "missing_stats",
      });
    },
  );

  it.each(["sex", "birth_date", "height_cm", "activity", "onboarding_weight_kg"] as const)(
    "should answer missing_stats when only %s is null",
    (field) => {
      expect(requireStats({ ...complete, [field]: null })).toStrictEqual({
        ok: false,
        reason: "missing_stats",
      });
    },
  );

  it("should answer missing_stats for a sex or an activity the engine does not know, and never guess", () => {
    expect(requireStats({ ...complete, sex: "unknown" })).toStrictEqual({
      ok: false,
      reason: "missing_stats",
    });
    expect(requireStats({ ...complete, activity: "athlete" })).toStrictEqual({
      ok: false,
      reason: "missing_stats",
    });
  });

  it("should answer missing_stats for a profile with nothing set", () => {
    expect(
      requireStats({
        sex: null,
        birth_date: null,
        height_cm: null,
        activity: null,
        onboarding_weight_kg: null,
      }),
    ).toStrictEqual({ ok: false, reason: "missing_stats" });
  });
});

describe("startSnapshot", () => {
  const snapshot = startSnapshot({
    stats: BUILD_PLAN_STATS,
    onboardingWeightKg: 80,
    asOfDate: "2026-10-22",
    trendWeightKg: null,
  });

  it("should start the Build Plan's man at mu 2413.125", () => {
    expect(snapshot.mu_kcal).toBe(2413.125);
  });

  it("should give the prior a variance of (0.15 * mu) squared, 131021.376", () => {
    expect(snapshot.var_kcal2).toBeCloseTo(131021.376, 3);
  });

  it("should be a start row as of the day given, with no measurement", () => {
    expect(snapshot.kind).toBe("start");
    expect(snapshot.as_of_date).toBe("2026-10-22");
    expect(snapshot.measurement).toBeNull();
  });

  it("should use the age on the day of the snapshot", () => {
    const dayBeforeBirthday = startSnapshot({
      stats: { ...BUILD_PLAN_STATS, birthDate: "1991-10-23" },
      onboardingWeightKg: 80,
      asOfDate: "2026-10-22",
      trendWeightKg: null,
    });

    expect(dayBeforeBirthday.mu_kcal).toBe(2420);
  });

  it("should take an activity factor over the level's own, inside the band", () => {
    const active = startSnapshot({
      stats: BUILD_PLAN_STATS,
      onboardingWeightKg: 80,
      asOfDate: "2026-10-22",
      trendWeightKg: null,
      activityFactor: 1.5,
    });

    expect(active.mu_kcal).toBe(2632.5);
  });

  it("should record the trend weight it is given, and null when the user has no weigh-in", () => {
    expect(snapshot.trend_weight_kg).toBeNull();
    expect(
      startSnapshot({
        stats: BUILD_PLAN_STATS,
        onboardingWeightKg: 80,
        asOfDate: "2026-10-22",
        trendWeightKg: 79.5,
      }).trend_weight_kg,
    ).toBe(79.5);
  });

  it("should read the params it is given: factor 1.5 and a prior cv of 0.2 at BMR 1850 give mu 2775 and var 308025", () => {
    const custom = startSnapshot(
      {
        stats: BUILD_PLAN_STATS,
        onboardingWeightKg: 80,
        asOfDate: "2026-10-22",
        trendWeightKg: null,
      },
      CUSTOM_PARAMS,
    );

    expect(custom.mu_kcal).toBe(2775);
    expect(custom.var_kcal2).toBeCloseTo(308025, 6);
    expect(custom.params).toStrictEqual(CUSTOM_PARAMS);
  });

  it("should take the engine version from the params it is given", () => {
    const custom = startSnapshot(
      {
        stats: BUILD_PLAN_STATS,
        onboardingWeightKg: 80,
        asOfDate: "2026-10-22",
        trendWeightKg: null,
      },
      CUSTOM_PARAMS,
    );

    expect(custom.engine_version).toBe("keylow-engine-test");
  });

  it("should carry the engine version and the whole default params", () => {
    expect(snapshot.engine_version).toBe("keylow-engine-v1");
    expect(snapshot.params).toStrictEqual(DEFAULT_ENGINE_PARAMS);
  });

  it("should name exactly the snapshot columns of ADR 0002, Amendment 2", () => {
    expect(Object.keys(snapshot).sort()).toStrictEqual([
      "as_of_date",
      "engine_version",
      "kind",
      "measurement",
      "mu_kcal",
      "params",
      "trend_weight_kg",
      "var_kcal2",
    ]);
  });
});

describe("startSnapshotAction (ADR 0002, Amendment 2, 'The start snapshot and the schedule')", () => {
  const today = "2026-10-22";

  it("should make a new snapshot when the user has none", () => {
    expect(startSnapshotAction({ latest: null, today, settling: false })).toBe("new");
  });

  it("should make a new snapshot when the newest is 29 days old", () => {
    expect(
      startSnapshotAction({
        latest: { kind: "start", as_of_date: "2026-09-23" },
        today,
        settling: true,
      }),
    ).toBe("new");
  });

  it("should not make a new snapshot when the newest is exactly 28 days old", () => {
    expect(
      startSnapshotAction({
        latest: { kind: "start", as_of_date: "2026-09-24" },
        today,
        settling: true,
      }),
    ).toBe("rewrite");
  });

  it("should make a new snapshot when the newest is a check-in more than 28 days old", () => {
    expect(
      startSnapshotAction({
        latest: { kind: "checkin", as_of_date: "2026-09-02" },
        today,
        settling: false,
      }),
    ).toBe("new");
  });

  it("should rewrite the start snapshot in place while the user is settling", () => {
    expect(
      startSnapshotAction({
        latest: { kind: "start", as_of_date: "2026-10-15" },
        today,
        settling: true,
      }),
    ).toBe("rewrite");
  });

  it("should do nothing for a user who has been through a check-in, measured or not", () => {
    expect(
      startSnapshotAction({
        latest: { kind: "checkin", as_of_date: "2026-10-15" },
        today,
        settling: false,
      }),
    ).toBe("none");
  });

  it("should do nothing when the start snapshot is not the newest, whatever the caller says about settling", () => {
    expect(
      startSnapshotAction({
        latest: { kind: "checkin", as_of_date: "2026-10-15" },
        today,
        settling: true,
      }),
    ).toBe("none");
  });

  it("should do nothing for a recent start snapshot when the user is not settling", () => {
    expect(
      startSnapshotAction({
        latest: { kind: "start", as_of_date: "2026-10-15" },
        today,
        settling: false,
      }),
    ).toBe("none");
  });
});
