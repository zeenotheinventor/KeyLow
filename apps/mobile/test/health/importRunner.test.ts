import { HEALTH_IMPORT_OVERLAP_DAYS } from "@keylow/core/weight";

import { createInMemoryHealthAnchorStore } from "./inMemoryHealthAnchorStore";
import { runHealthImport } from "../../lib/health/importRunner";
import { createFakeHealthProvider } from "../support/fakeHealthProvider";

import type { HealthImportDependencies } from "../../lib/health/importRunner";
import type { FakeHealthProvider } from "../support/fakeHealthProvider";
import type {
  BodyMeasurementInsert,
  HealthBodyFatSample,
  HealthLeanMassSample,
  HealthWeighInInsert,
  HealthWeightSample,
} from "@keylow/core/weight";

const userId = "0b6f5c2e-4f6a-4e0a-9d52-6a1f6d8f3c11";
const otherUserId = "7c1d9f3a-2b5e-4a8c-8f21-3e4d5a6b7c8d";
const timeZone = "Europe/London";
const now = new Date("2026-10-23T10:00:00.000Z");
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function sampleOn(day: number, overrides: Partial<HealthWeightSample> = {}): HealthWeightSample {
  const dayText = String(day).padStart(2, "0");
  return {
    sampleId: `sample-id-${dayText}`,
    measuredAt: `2026-10-${dayText}T07:30:00.000Z`,
    value: 81.234,
    unit: "kilograms",
    ...overrides,
  };
}

/** Twenty samples, one a day from 1 to 20 October. */
const twentySamples = Array.from({ length: 20 }, (_, index) => sampleOn(index + 1));
const newestOfTwenty = "2026-10-20T07:30:00.000Z";

function bodyFatOn(day: number, overrides: Partial<HealthBodyFatSample> = {}): HealthBodyFatSample {
  const dayText = String(day).padStart(2, "0");
  return {
    sampleId: `fat-id-${dayText}`,
    measuredAt: `2026-10-${dayText}T07:35:00.000Z`,
    value: 23.456,
    ...overrides,
  };
}

function leanMassOn(
  day: number,
  overrides: Partial<HealthLeanMassSample> = {},
): HealthLeanMassSample {
  const dayText = String(day).padStart(2, "0");
  return {
    sampleId: `lean-id-${dayText}`,
    measuredAt: `2026-10-${dayText}T07:40:00.000Z`,
    value: 54.321,
    unit: "kilograms",
    ...overrides,
  };
}

/** Ten samples of each body composition kind, one a day from 1 to 10 October. */
const tenBodyFat = Array.from({ length: 10 }, (_, index) => bodyFatOn(index + 1));
const tenLeanMass = Array.from({ length: 10 }, (_, index) => leanMassOn(index + 1));
const newestBodyFat = "2026-10-10T07:35:00.000Z";
const newestLeanMass = "2026-10-10T07:40:00.000Z";

/** Both kinds allowed and holding ten samples each, for a run that imports body composition. */
const withBodyComposition = {
  bodyCompositionAccess: { bodyFat: true, leanMass: true },
  bodyFatSamples: tenBodyFat,
  leanMassSamples: tenLeanMass,
} as const;

const notRun = { status: "not-run", read: 0, skipped: 0, inserted: 0 } as const;
const noPermission = { status: "no-permission", read: 0, skipped: 0, inserted: 0 } as const;
const failedKind = { status: "failed", read: 0, skipped: 0, inserted: 0 } as const;

function daysBefore(instant: string, days: number): string {
  return new Date(Date.parse(instant) - days * DAY_IN_MILLISECONDS).toISOString();
}

type Setup = {
  provider: FakeHealthProvider;
  anchorStore: ReturnType<typeof createInMemoryHealthAnchorStore>;
  importWeighIns: jest.Mock<Promise<{ inserted: number }>, [readonly HealthWeighInInsert[]]>;
  importBodyMeasurements: jest.Mock<
    Promise<{ inserted: number }>,
    [readonly BodyMeasurementInsert[]]
  >;
  dependencies: HealthImportDependencies;
};

function setUp(
  providerState: Parameters<typeof createFakeHealthProvider>[0] = {},
  overrides: Partial<HealthImportDependencies> = {},
): Setup {
  const provider = createFakeHealthProvider({
    permissionGranted: true,
    samples: twentySamples,
    ...providerState,
  });
  const anchorStore = createInMemoryHealthAnchorStore();
  const importWeighIns: Setup["importWeighIns"] = jest.fn((rows) =>
    Promise.resolve({ inserted: rows.length }),
  );
  const importBodyMeasurements: Setup["importBodyMeasurements"] = jest.fn((rows) =>
    Promise.resolve({ inserted: rows.length }),
  );
  const dependencies: HealthImportDependencies = {
    userId,
    provider,
    anchorStore,
    timeZone,
    importWeighIns,
    importBodyMeasurements,
    now: () => now,
    ...overrides,
  };
  return { provider, anchorStore, importWeighIns, importBodyMeasurements, dependencies };
}

function sincesRead(provider: FakeHealthProvider): (string | null)[] {
  return provider.calls.flatMap((call) => (call.method === "readWeightSince" ? [call.since] : []));
}

describe("runHealthImport", () => {
  describe("a run that works", () => {
    it("should read everything on the first import and report the counts", async () => {
      const { provider, importWeighIns, dependencies } = setUp();

      const result = await runHealthImport(dependencies);

      expect(sincesRead(provider)).toEqual([null]);
      expect(importWeighIns).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ status: "imported", read: 20, skipped: 0, inserted: 20 });
    });

    it("should map the samples with the profile time zone", async () => {
      const { importWeighIns, dependencies } = setUp({ samples: [sampleOn(3)] });

      await runHealthImport(dependencies);

      expect(importWeighIns).toHaveBeenCalledWith([
        expect.objectContaining({
          source: "health_connect",
          external_id: "sample-id-03",
          tz: timeZone,
          weight_kg: 81.234,
        }),
      ]);
    });

    it("should lead three imports of the same samples to the same rows, each from the anchor minus the overlap", async () => {
      const { provider, anchorStore, importWeighIns, dependencies } = setUp();
      const sinceAfterAnchor = daysBefore(newestOfTwenty, HEALTH_IMPORT_OVERLAP_DAYS);
      // Health Connect returns the same twenty each time, whatever the start, as it does when they all
      // fall inside the overlap.
      provider.readWeightSince = (since) => {
        provider.calls.push({ method: "readWeightSince", since });
        return Promise.resolve({
          samples: twentySamples,
          newestSampleAt: newestOfTwenty,
          skippedRecords: 0,
        });
      };

      await runHealthImport(dependencies);
      expect(await anchorStore.getAnchor(userId)).toBe(newestOfTwenty);
      await runHealthImport(dependencies);
      expect(await anchorStore.getAnchor(userId)).toBe(newestOfTwenty);
      await runHealthImport(dependencies);
      expect(await anchorStore.getAnchor(userId)).toBe(newestOfTwenty);

      expect(sincesRead(provider)).toEqual([null, sinceAfterAnchor, sinceAfterAnchor]);
      expect(importWeighIns).toHaveBeenCalledTimes(3);
      expect(importWeighIns.mock.calls[1]?.[0]).toEqual(importWeighIns.mock.calls[0]?.[0]);
      expect(importWeighIns.mock.calls[2]?.[0]).toEqual(importWeighIns.mock.calls[0]?.[0]);
    });

    it("should read the anchor per user, so a second user starts with none", async () => {
      const { provider, dependencies } = setUp();
      await runHealthImport(dependencies);

      await runHealthImport({ ...dependencies, userId: otherUserId });

      expect(sincesRead(provider)).toEqual([null, null]);
    });

    it("should count the provider's skipped records and the samples the mapper drops", async () => {
      const { dependencies } = setUp({
        samples: [sampleOn(1), sampleOn(2, { value: 5000 }), sampleOn(3)],
        skippedRecords: 4,
      });

      const result = await runHealthImport(dependencies);

      expect(result).toMatchObject({ status: "imported", read: 3, skipped: 5, inserted: 2 });
    });

    it("should report the rows the save stored as inserted, not the rows it was given", async () => {
      const { importWeighIns, dependencies } = setUp();
      importWeighIns.mockResolvedValueOnce({ inserted: 3 });

      const result = await runHealthImport(dependencies);

      expect(result).toMatchObject({ status: "imported", read: 20, skipped: 0, inserted: 3 });
    });

    it("should skip the save when no sample is usable, and still move the anchor past them", async () => {
      const { anchorStore, importWeighIns, dependencies } = setUp({
        samples: [sampleOn(2, { value: 5000 })],
      });

      const result = await runHealthImport(dependencies);

      expect(importWeighIns).not.toHaveBeenCalled();
      expect(result).toMatchObject({ status: "imported", read: 1, skipped: 1, inserted: 0 });
      expect(await anchorStore.getAnchor(userId)).toBe("2026-10-02T07:30:00.000Z");
    });

    it("should treat a stored anchor that is not a time as no anchor", async () => {
      const { provider, anchorStore, dependencies } = setUp();
      await anchorStore.setAnchor(userId, "not a time");

      await runHealthImport(dependencies);

      expect(sincesRead(provider)).toEqual([null]);
    });
  });

  describe("the anchor", () => {
    it("should be set to the newest sample time only after the save resolves", async () => {
      const { anchorStore, importWeighIns, dependencies } = setUp();
      let finishSave: (outcome: { inserted: number }) => void = () => undefined;
      importWeighIns.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishSave = resolve;
          }),
      );

      const running = runHealthImport(dependencies);
      await new Promise((resolve) => setImmediate(resolve));
      const anchorWhileSaving = await anchorStore.getAnchor(userId);
      // Settled before the assertions, so a failure here cannot leave the import running for the next test.
      finishSave({ inserted: 20 });
      await running;

      expect(importWeighIns).toHaveBeenCalledTimes(1);
      expect(anchorWhileSaving).toBeNull();
      expect(await anchorStore.getAnchor(userId)).toBe(newestOfTwenty);
    });

    it("should stay as it was, and the status be failed, when the save rejects", async () => {
      const { anchorStore, importWeighIns, dependencies } = setUp();
      await anchorStore.setAnchor(userId, "2026-10-05T07:30:00.000Z");
      importWeighIns.mockRejectedValueOnce(new Error("database unavailable"));

      const result = await runHealthImport(dependencies);

      expect(result.status).toBe("failed");
      expect(await anchorStore.getAnchor(userId)).toBe("2026-10-05T07:30:00.000Z");
      expect(anchorStore.writes.filter((write) => write.kind === "anchor")).toHaveLength(1);
    });

    it("should be clamped to now when a sample is dated in the future", async () => {
      const { anchorStore, dependencies } = setUp({
        samples: [sampleOn(2), sampleOn(25)],
      });

      await runHealthImport(dependencies);

      expect(await anchorStore.getAnchor(userId)).toBe(now.toISOString());
    });

    it("should not move back when the samples read are older than the anchor", async () => {
      // 15 October is inside the overlap window of an anchor on 20 October, so it is read.
      const { anchorStore, dependencies } = setUp({ samples: [sampleOn(15)] });
      await anchorStore.setAnchor(userId, newestOfTwenty);

      const result = await runHealthImport(dependencies);

      expect(result.status).toBe("imported");
      expect(result.read).toBe(1);
      expect(await anchorStore.getAnchor(userId)).toBe(newestOfTwenty);
    });

    it("should not be written again when it would not move", async () => {
      const { anchorStore, dependencies } = setUp();
      await runHealthImport(dependencies);

      await runHealthImport(dependencies);

      expect(anchorStore.writes.filter((write) => write.kind === "anchor")).toHaveLength(1);
    });
  });

  describe("the last import time", () => {
    it("should be the clock's time after an import", async () => {
      const { anchorStore, dependencies } = setUp();

      await runHealthImport(dependencies);

      expect(await anchorStore.getLastImport(userId)).toBe(now.toISOString());
    });

    it("should be the clock's time after nothing new, and the anchor left alone", async () => {
      const { anchorStore, dependencies } = setUp({ samples: [] });

      const result = await runHealthImport(dependencies);

      expect(result).toMatchObject({ status: "nothing-new", read: 0, skipped: 0, inserted: 0 });
      expect(await anchorStore.getLastImport(userId)).toBe(now.toISOString());
      expect(await anchorStore.getAnchor(userId)).toBeNull();
    });

    it("should be unchanged after a failed import", async () => {
      const { anchorStore, importWeighIns, dependencies } = setUp();
      importWeighIns.mockRejectedValueOnce(new Error("database unavailable"));

      await runHealthImport(dependencies);

      expect(await anchorStore.getLastImport(userId)).toBeNull();
    });

    it("should be unchanged when there is no permission or the provider is unavailable", async () => {
      const withoutPermission = setUp({ permissionGranted: false });
      const unavailable = setUp({ availability: "unsupported" });

      await runHealthImport(withoutPermission.dependencies);
      await runHealthImport(unavailable.dependencies);

      expect(withoutPermission.anchorStore.writes).toEqual([]);
      expect(unavailable.anchorStore.writes).toEqual([]);
    });
  });

  describe("a run that does not start", () => {
    it("should be unavailable, with no read, when there is no provider", async () => {
      const { importWeighIns, anchorStore, dependencies } = setUp();

      const result = await runHealthImport({ ...dependencies, provider: null });

      expect(result).toMatchObject({ status: "unavailable", read: 0, skipped: 0, inserted: 0 });
      expect(importWeighIns).not.toHaveBeenCalled();
      expect(anchorStore.writes).toEqual([]);
    });

    it.each(["needs-install", "unsupported"] as const)(
      "should be unavailable, with no read, when the provider is %s",
      async (availability) => {
        const { provider, dependencies } = setUp({ availability });

        const result = await runHealthImport(dependencies);

        expect(result.status).toBe("unavailable");
        expect(sincesRead(provider)).toEqual([]);
      },
    );

    it("should be no-permission, with no read or write, and never ask for permission", async () => {
      const { provider, importWeighIns, anchorStore, dependencies } = setUp({
        permissionGranted: false,
      });

      const result = await runHealthImport(dependencies);

      expect(result).toMatchObject({ status: "no-permission", read: 0, skipped: 0, inserted: 0 });
      expect(sincesRead(provider)).toEqual([]);
      expect(provider.calls.map((call) => call.method)).not.toContain("requestPermission");
      expect(importWeighIns).not.toHaveBeenCalled();
      expect(anchorStore.writes).toEqual([]);
    });

    it("should make no import while the time zone is not known", async () => {
      const { provider, importWeighIns, anchorStore, dependencies } = setUp();

      const result = await runHealthImport({ ...dependencies, timeZone: null });

      expect(result.status).toBe("failed");
      expect(sincesRead(provider)).toEqual([]);
      expect(importWeighIns).not.toHaveBeenCalled();
      expect(anchorStore.writes).toEqual([]);
    });
  });

  describe("a provider that throws", () => {
    it("should be no-permission when the read is refused for want of access", async () => {
      const { anchorStore, dependencies } = setUp({ failures: { readWeightSince: "permission" } });

      const result = await runHealthImport(dependencies);

      expect(result).toMatchObject({ status: "no-permission", read: 0, skipped: 0, inserted: 0 });
      expect(anchorStore.writes).toEqual([]);
    });

    it("should be failed when the read fails for another reason", async () => {
      const { importWeighIns, anchorStore, dependencies } = setUp({
        failures: { readWeightSince: "failed" },
      });

      const result = await runHealthImport(dependencies);

      expect(result.status).toBe("failed");
      expect(importWeighIns).not.toHaveBeenCalled();
      expect(anchorStore.writes).toEqual([]);
    });

    it("should be failed, and not throw, when the provider throws something else", async () => {
      const { provider, dependencies } = setUp();
      jest.spyOn(provider, "readWeightSince").mockRejectedValueOnce(new TypeError("81.234"));

      await expect(runHealthImport(dependencies)).resolves.toMatchObject({ status: "failed" });
    });
  });

  describe("single flight", () => {
    it("should read once and give both callers the same result when two start together", async () => {
      const { provider, importWeighIns, dependencies } = setUp();

      const first = runHealthImport(dependencies);
      const second = runHealthImport(dependencies);
      const [firstResult, secondResult] = await Promise.all([first, second]);

      expect(sincesRead(provider)).toEqual([null]);
      expect(importWeighIns).toHaveBeenCalledTimes(1);
      expect(secondResult).toBe(firstResult);
    });

    it("should start a new import for a request after the others settle", async () => {
      const { provider, dependencies } = setUp();
      await Promise.all([runHealthImport(dependencies), runHealthImport(dependencies)]);

      await runHealthImport(dependencies);

      expect(sincesRead(provider)).toHaveLength(2);
    });

    it("should start a new import after one that failed", async () => {
      const { provider, importWeighIns, dependencies } = setUp();
      importWeighIns.mockRejectedValueOnce(new Error("database unavailable"));
      await runHealthImport(dependencies);

      const result = await runHealthImport(dependencies);

      expect(result.status).toBe("imported");
      expect(sincesRead(provider)).toHaveLength(2);
    });

    it("should not hand one user's running import to another user", async () => {
      const { provider, dependencies } = setUp();

      await Promise.all([
        runHealthImport(dependencies),
        runHealthImport({ ...dependencies, userId: otherUserId }),
      ]);

      expect(sincesRead(provider)).toHaveLength(2);
    });
  });

  describe("body composition in the same pass", () => {
    function bodySinces(provider: FakeHealthProvider) {
      return provider.calls.flatMap((call) =>
        call.method === "readBodyCompositionSince" ? [call.since] : [],
      );
    }

    function savedKinds(importBodyMeasurements: Setup["importBodyMeasurements"]) {
      return importBodyMeasurements.mock.calls.map(([rows]) => rows.map((row) => row.kind));
    }

    it("should read and save both kinds after the weight, and report each kind's counts", async () => {
      const { provider, importWeighIns, importBodyMeasurements, dependencies } =
        setUp(withBodyComposition);

      const result = await runHealthImport(dependencies);

      expect(bodySinces(provider)).toEqual([{ bodyFat: null, leanMass: null }]);
      expect(importBodyMeasurements).toHaveBeenCalledTimes(2);
      expect(new Set(savedKinds(importBodyMeasurements)[0])).toEqual(new Set(["body_fat_pct"]));
      expect(new Set(savedKinds(importBodyMeasurements)[1])).toEqual(new Set(["lean_mass_kg"]));
      expect(importWeighIns.mock.invocationCallOrder[0]).toBeLessThan(
        importBodyMeasurements.mock.invocationCallOrder[0] ?? 0,
      );
      expect(result).toEqual({
        status: "imported",
        read: 20,
        skipped: 0,
        inserted: 20,
        body: {
          bodyFat: { status: "imported", read: 10, skipped: 0, inserted: 10 },
          leanMass: { status: "imported", read: 10, skipped: 0, inserted: 10 },
        },
      });
    });

    it("should map the samples with the profile time zone", async () => {
      const { importBodyMeasurements, dependencies } = setUp({
        ...withBodyComposition,
        bodyFatSamples: [bodyFatOn(3)],
        leanMassSamples: [leanMassOn(4)],
      });

      await runHealthImport(dependencies);

      expect(importBodyMeasurements).toHaveBeenNthCalledWith(1, [
        expect.objectContaining({
          kind: "body_fat_pct",
          source: "health_connect",
          external_id: "fat-id-03",
          tz: timeZone,
          value: 23.456,
        }),
      ]);
      expect(importBodyMeasurements).toHaveBeenNthCalledWith(2, [
        expect.objectContaining({
          kind: "lean_mass_kg",
          source: "health_connect",
          external_id: "lean-id-04",
          tz: timeZone,
          value: 54.321,
        }),
      ]);
    });

    it("should lead three imports of the same samples to the same rows per kind, each kind from its own anchor minus the overlap", async () => {
      const { provider, anchorStore, importBodyMeasurements, dependencies } =
        setUp(withBodyComposition);
      const sinceAfterBodyFat = daysBefore(newestBodyFat, HEALTH_IMPORT_OVERLAP_DAYS);
      const sinceAfterLeanMass = daysBefore(newestLeanMass, HEALTH_IMPORT_OVERLAP_DAYS);
      // Health Connect returns the same ten of each kind every time, as it does when they all fall
      // inside the overlap.
      provider.readBodyCompositionSince = (since) => {
        provider.calls.push({ method: "readBodyCompositionSince", since });
        return Promise.resolve({
          bodyFat: {
            status: "read",
            samples: tenBodyFat,
            newestSampleAt: newestBodyFat,
            skippedRecords: 0,
          },
          leanMass: {
            status: "read",
            samples: tenLeanMass,
            newestSampleAt: newestLeanMass,
            skippedRecords: 0,
          },
        });
      };

      for (let run = 0; run < 3; run += 1) {
        await runHealthImport(dependencies);
        expect(await anchorStore.getBodyAnchor(userId, "body_fat_pct")).toBe(newestBodyFat);
        expect(await anchorStore.getBodyAnchor(userId, "lean_mass_kg")).toBe(newestLeanMass);
      }

      expect(bodySinces(provider)).toEqual([
        { bodyFat: null, leanMass: null },
        { bodyFat: sinceAfterBodyFat, leanMass: sinceAfterLeanMass },
        { bodyFat: sinceAfterBodyFat, leanMass: sinceAfterLeanMass },
      ]);
      expect(importBodyMeasurements).toHaveBeenCalledTimes(6);
      const calls = importBodyMeasurements.mock.calls;
      expect(calls[2]).toEqual(calls[0]);
      expect(calls[4]).toEqual(calls[0]);
      expect(calls[3]).toEqual(calls[1]);
      expect(calls[5]).toEqual(calls[1]);
    });

    it("should start a kind allowed later from none while the weight reads from its anchor", async () => {
      const { provider, anchorStore, dependencies } = setUp();
      await runHealthImport(dependencies);
      provider.state.bodyCompositionAccess = { bodyFat: true, leanMass: false };
      provider.state.bodyFatSamples = tenBodyFat;
      provider.calls.length = 0;

      await runHealthImport(dependencies);

      expect(sincesRead(provider)).toEqual([
        daysBefore(newestOfTwenty, HEALTH_IMPORT_OVERLAP_DAYS),
      ]);
      expect(bodySinces(provider)).toEqual([{ bodyFat: null, leanMass: null }]);
      expect(await anchorStore.getBodyAnchor(userId, "body_fat_pct")).toBe(newestBodyFat);
      expect(await anchorStore.getBodyAnchor(userId, "lean_mass_kg")).toBeNull();
    });

    it("should read a kind that has an anchor from it, and the other from none", async () => {
      const { provider, anchorStore, dependencies } = setUp(withBodyComposition);
      await anchorStore.setBodyAnchor(userId, "body_fat_pct", newestBodyFat);

      await runHealthImport(dependencies);

      expect(bodySinces(provider)).toEqual([
        { bodyFat: daysBefore(newestBodyFat, HEALTH_IMPORT_OVERLAP_DAYS), leanMass: null },
      ]);
    });

    it("should treat a stored body anchor that is not a time as none", async () => {
      const { provider, anchorStore, dependencies } = setUp(withBodyComposition);
      await anchorStore.setBodyAnchor(userId, "lean_mass_kg", "not a time");

      await runHealthImport(dependencies);

      expect(bodySinces(provider)).toEqual([{ bodyFat: null, leanMass: null }]);
    });

    it("should keep the body anchors per user", async () => {
      const { provider, dependencies } = setUp(withBodyComposition);
      await runHealthImport(dependencies);

      await runHealthImport({ ...dependencies, userId: otherUserId });

      expect(bodySinces(provider)).toEqual([
        { bodyFat: null, leanMass: null },
        { bodyFat: null, leanMass: null },
      ]);
    });

    it("should count the provider's skipped records and the samples the mapper drops, per kind", async () => {
      const { dependencies } = setUp({
        ...withBodyComposition,
        bodyFatSamples: [bodyFatOn(1), bodyFatOn(2, { value: 150 })],
        leanMassSamples: [leanMassOn(1)],
        bodyCompositionSkippedRecords: { bodyFat: 2, leanMass: 0 },
      });

      const result = await runHealthImport(dependencies);

      expect(result.body).toEqual({
        bodyFat: { status: "imported", read: 2, skipped: 3, inserted: 1 },
        leanMass: { status: "imported", read: 1, skipped: 0, inserted: 1 },
      });
    });

    it("should report the rows the save stored as inserted, not the rows it was given", async () => {
      const { importBodyMeasurements, dependencies } = setUp(withBodyComposition);
      importBodyMeasurements.mockResolvedValueOnce({ inserted: 3 });

      const result = await runHealthImport(dependencies);

      expect(result.body.bodyFat).toEqual({
        status: "imported",
        read: 10,
        skipped: 0,
        inserted: 3,
      });
    });

    it("should skip the save for a kind with no usable sample, and still move its anchor past them", async () => {
      const { anchorStore, importBodyMeasurements, dependencies } = setUp({
        ...withBodyComposition,
        bodyFatSamples: [bodyFatOn(2, { value: 150 })],
        leanMassSamples: [],
      });

      const result = await runHealthImport(dependencies);

      expect(savedKinds(importBodyMeasurements)).toEqual([]);
      expect(result.body.bodyFat).toEqual({ status: "imported", read: 1, skipped: 1, inserted: 0 });
      expect(await anchorStore.getBodyAnchor(userId, "body_fat_pct")).toBe(
        "2026-10-02T07:35:00.000Z",
      );
    });

    it("should leave the last import time to the weight step", async () => {
      const { anchorStore, dependencies } = setUp({ ...withBodyComposition, samples: [] });
      await anchorStore.setLastImport(userId, "2026-10-22T09:00:00.000Z");

      await runHealthImport(dependencies);

      expect(anchorStore.writes.filter((write) => write.kind === "lastImport")).toHaveLength(2);
      expect(await anchorStore.getLastImport(userId)).toBe(now.toISOString());
    });

    it("should not set the last import time when only body composition imported", async () => {
      const { anchorStore, dependencies } = setUp({
        ...withBodyComposition,
        failures: { readWeightSince: "failed" },
      });

      await runHealthImport(dependencies);

      expect(await anchorStore.getLastImport(userId)).toBeNull();
    });
  });

  describe("the body composition anchors", () => {
    it("should be set to a kind's newest sample time only after that kind's save resolves", async () => {
      const { anchorStore, importBodyMeasurements, dependencies } = setUp(withBodyComposition);
      let finishBodyFatSave: (outcome: { inserted: number }) => void = () => undefined;
      importBodyMeasurements.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishBodyFatSave = resolve;
          }),
      );

      const running = runHealthImport(dependencies);
      await new Promise((resolve) => setImmediate(resolve));
      const bodyFatAnchorWhileSaving = await anchorStore.getBodyAnchor(userId, "body_fat_pct");
      // Settled before the assertions, so a failure here cannot leave the import running for the next test.
      finishBodyFatSave({ inserted: 10 });
      await running;

      expect(bodyFatAnchorWhileSaving).toBeNull();
      expect(await anchorStore.getBodyAnchor(userId, "body_fat_pct")).toBe(newestBodyFat);
      expect(await anchorStore.getBodyAnchor(userId, "lean_mass_kg")).toBe(newestLeanMass);
    });

    it("should stay as it was, with that kind failed, when its save rejects, and leave the other kind and the weight imported", async () => {
      const { anchorStore, importBodyMeasurements, dependencies } = setUp(withBodyComposition);
      await anchorStore.setBodyAnchor(userId, "body_fat_pct", "2026-10-05T07:35:00.000Z");
      importBodyMeasurements.mockRejectedValueOnce(new Error("database unavailable"));

      const result = await runHealthImport(dependencies);

      expect(result).toEqual({
        status: "imported",
        read: 20,
        skipped: 0,
        inserted: 20,
        body: {
          bodyFat: failedKind,
          leanMass: { status: "imported", read: 10, skipped: 0, inserted: 10 },
        },
      });
      expect(await anchorStore.getBodyAnchor(userId, "body_fat_pct")).toBe(
        "2026-10-05T07:35:00.000Z",
      );
      expect(await anchorStore.getBodyAnchor(userId, "lean_mass_kg")).toBe(newestLeanMass);
      expect(await anchorStore.getAnchor(userId)).toBe(newestOfTwenty);
    });

    it("should leave body fat saved when the lean mass save rejects", async () => {
      const { anchorStore, importBodyMeasurements, dependencies } = setUp(withBodyComposition);
      importBodyMeasurements
        .mockResolvedValueOnce({ inserted: 10 })
        .mockRejectedValueOnce(new Error("database unavailable"));

      const result = await runHealthImport(dependencies);

      expect(result.body.bodyFat.status).toBe("imported");
      expect(result.body.leanMass).toEqual(failedKind);
      expect(await anchorStore.getBodyAnchor(userId, "body_fat_pct")).toBe(newestBodyFat);
      expect(await anchorStore.getBodyAnchor(userId, "lean_mass_kg")).toBeNull();
    });

    it("should be clamped to now when a sample is dated in the future", async () => {
      const { anchorStore, dependencies } = setUp({
        ...withBodyComposition,
        bodyFatSamples: [bodyFatOn(2), bodyFatOn(25)],
        leanMassSamples: [leanMassOn(2), leanMassOn(26)],
      });

      await runHealthImport(dependencies);

      expect(await anchorStore.getBodyAnchor(userId, "body_fat_pct")).toBe(now.toISOString());
      expect(await anchorStore.getBodyAnchor(userId, "lean_mass_kg")).toBe(now.toISOString());
    });

    it("should not move back when the samples read are older than the anchor", async () => {
      // 8 October is inside the overlap window of an anchor on 10 October, so it is read.
      const { anchorStore, dependencies } = setUp({
        ...withBodyComposition,
        bodyFatSamples: [bodyFatOn(8)],
        leanMassSamples: [leanMassOn(8)],
      });
      await anchorStore.setBodyAnchor(userId, "body_fat_pct", newestBodyFat);
      await anchorStore.setBodyAnchor(userId, "lean_mass_kg", newestLeanMass);

      const result = await runHealthImport(dependencies);

      expect(result.body.bodyFat.status).toBe("imported");
      expect(await anchorStore.getBodyAnchor(userId, "body_fat_pct")).toBe(newestBodyFat);
      expect(await anchorStore.getBodyAnchor(userId, "lean_mass_kg")).toBe(newestLeanMass);
    });

    it("should not be written again when it would not move", async () => {
      const { anchorStore, dependencies } = setUp(withBodyComposition);
      await runHealthImport(dependencies);

      await runHealthImport(dependencies);

      expect(anchorStore.writes.filter((write) => write.kind === "bodyAnchor")).toHaveLength(2);
    });
  });

  describe("body composition never breaking the weight import", () => {
    async function weightOnlyResult() {
      const { dependencies } = setUp();
      const { status, read, skipped, inserted } = await runHealthImport(dependencies);
      return { status, read, skipped, inserted };
    }

    const scriptedFailures = [
      [
        "refused for both kinds",
        { bodyCompositionReadStatus: { bodyFat: "no-permission", leanMass: "no-permission" } },
      ],
      [
        "failing for both kinds",
        { bodyCompositionReadStatus: { bodyFat: "failed", leanMass: "failed" } },
      ],
    ] as const;

    it.each(scriptedFailures)(
      "should give the weight result a weight-only run gives when the body read is %s",
      async (_name, providerState) => {
        const expected = await weightOnlyResult();
        const { anchorStore, importBodyMeasurements, dependencies } = setUp({
          ...withBodyComposition,
          ...providerState,
        });

        const { body, ...weight } = await runHealthImport(dependencies);

        expect(weight).toEqual(expected);
        expect(body.bodyFat.status).toBe(providerState.bodyCompositionReadStatus.bodyFat);
        expect(body.leanMass.status).toBe(providerState.bodyCompositionReadStatus.leanMass);
        expect(importBodyMeasurements).not.toHaveBeenCalled();
        expect(await anchorStore.getAnchor(userId)).toBe(newestOfTwenty);
        expect(await anchorStore.getLastImport(userId)).toBe(now.toISOString());
      },
    );

    it("should give the weight result a weight-only run gives when a body save rejects", async () => {
      const expected = await weightOnlyResult();
      const { anchorStore, importBodyMeasurements, dependencies } = setUp(withBodyComposition);
      importBodyMeasurements.mockRejectedValue(new Error("database unavailable"));

      const { body, ...weight } = await runHealthImport(dependencies);

      expect(weight).toEqual(expected);
      expect(body).toEqual({ bodyFat: failedKind, leanMass: failedKind });
      expect(await anchorStore.getAnchor(userId)).toBe(newestOfTwenty);
      expect(await anchorStore.getLastImport(userId)).toBe(now.toISOString());
    });

    it("should resolve, with both kinds failed, when the body read throws", async () => {
      const expected = await weightOnlyResult();
      const { provider, dependencies } = setUp(withBodyComposition);
      jest
        .spyOn(provider, "readBodyCompositionSince")
        .mockRejectedValueOnce(new TypeError("23.456"));

      const { body, ...weight } = await runHealthImport(dependencies);

      expect(weight).toEqual(expected);
      expect(body).toEqual({ bodyFat: failedKind, leanMass: failedKind });
    });

    it("should resolve, with both kinds failed, when a body anchor cannot be read", async () => {
      const { anchorStore, importBodyMeasurements, dependencies } = setUp(withBodyComposition);
      jest.spyOn(anchorStore, "getBodyAnchor").mockRejectedValue(new Error("keystore locked"));

      const result = await runHealthImport(dependencies);

      expect(result.status).toBe("imported");
      expect(result.body).toEqual({ bodyFat: failedKind, leanMass: failedKind });
      expect(importBodyMeasurements).not.toHaveBeenCalled();
    });

    it("should resolve, with that kind failed, when a body anchor cannot be written", async () => {
      const { anchorStore, dependencies } = setUp(withBodyComposition);
      jest.spyOn(anchorStore, "setBodyAnchor").mockRejectedValueOnce(new Error("keystore locked"));

      const result = await runHealthImport(dependencies);

      expect(result.status).toBe("imported");
      expect(result.body.bodyFat.status).toBe("failed");
      expect(result.body.leanMass.status).toBe("imported");
    });

    it("should still import body composition when the weight read fails, with the top-level status failed", async () => {
      const { anchorStore, importWeighIns, dependencies } = setUp({
        ...withBodyComposition,
        failures: { readWeightSince: "failed" },
      });

      const result = await runHealthImport(dependencies);

      expect(result).toEqual({
        status: "failed",
        read: 0,
        skipped: 0,
        inserted: 0,
        body: {
          bodyFat: { status: "imported", read: 10, skipped: 0, inserted: 10 },
          leanMass: { status: "imported", read: 10, skipped: 0, inserted: 10 },
        },
      });
      expect(importWeighIns).not.toHaveBeenCalled();
      expect(await anchorStore.getAnchor(userId)).toBeNull();
      expect(await anchorStore.getBodyAnchor(userId, "body_fat_pct")).toBe(newestBodyFat);
    });

    it("should still import body composition when the weight save rejects", async () => {
      const { anchorStore, importWeighIns, dependencies } = setUp(withBodyComposition);
      importWeighIns.mockRejectedValueOnce(new Error("database unavailable"));

      const result = await runHealthImport(dependencies);

      expect(result.status).toBe("failed");
      expect(result.body.bodyFat.status).toBe("imported");
      expect(result.body.leanMass.status).toBe("imported");
      expect(await anchorStore.getAnchor(userId)).toBeNull();
    });

    it("should still import body composition when the weight read is refused, with the top-level status no-permission", async () => {
      const { dependencies } = setUp({
        ...withBodyComposition,
        failures: { readWeightSince: "permission" },
      });

      const result = await runHealthImport(dependencies);

      expect(result.status).toBe("no-permission");
      expect(result.body.bodyFat.status).toBe("imported");
    });
  });

  describe("an empty body composition read", () => {
    it("should be nothing-new for a kind with no samples, and leave its anchor alone", async () => {
      const { anchorStore, importBodyMeasurements, dependencies } = setUp({
        ...withBodyComposition,
        bodyFatSamples: [],
        leanMassSamples: [],
      });

      const result = await runHealthImport(dependencies);

      expect(result.body).toEqual({
        bodyFat: { status: "nothing-new", read: 0, skipped: 0, inserted: 0 },
        leanMass: { status: "nothing-new", read: 0, skipped: 0, inserted: 0 },
      });
      expect(importBodyMeasurements).not.toHaveBeenCalled();
      expect(await anchorStore.getBodyAnchor(userId, "body_fat_pct")).toBeNull();
      expect(await anchorStore.getBodyAnchor(userId, "lean_mass_kg")).toBeNull();
    });

    it("should keep the provider's skipped count on a kind that is nothing-new", async () => {
      const { dependencies } = setUp({
        ...withBodyComposition,
        bodyFatSamples: [],
        bodyCompositionSkippedRecords: { bodyFat: 2, leanMass: 0 },
      });

      const result = await runHealthImport(dependencies);

      expect(result.body.bodyFat).toEqual({
        status: "nothing-new",
        read: 0,
        skipped: 2,
        inserted: 0,
      });
    });

    it("should be imported for body fat and nothing-new for lean mass when only body fat has data", async () => {
      const { dependencies } = setUp({ ...withBodyComposition, leanMassSamples: [] });

      const result = await runHealthImport(dependencies);

      expect(result.body.bodyFat.status).toBe("imported");
      expect(result.body.leanMass.status).toBe("nothing-new");
    });

    it("should be no-permission for a kind not allowed, and import the other", async () => {
      const { dependencies } = setUp({
        ...withBodyComposition,
        bodyCompositionAccess: { bodyFat: false, leanMass: true },
      });

      const result = await runHealthImport(dependencies);

      expect(result.body.bodyFat).toEqual(noPermission);
      expect(result.body.leanMass.status).toBe("imported");
    });

    it("should still save body fat when the weight is nothing-new", async () => {
      const { importBodyMeasurements, dependencies } = setUp({
        ...withBodyComposition,
        samples: [],
      });

      const result = await runHealthImport(dependencies);

      expect(result.status).toBe("nothing-new");
      expect(result.body.bodyFat).toEqual({
        status: "imported",
        read: 10,
        skipped: 0,
        inserted: 10,
      });
      expect(importBodyMeasurements).toHaveBeenCalledTimes(2);
    });
  });

  describe("a run that does not start, for body composition", () => {
    const earlyReturns = [
      ["the provider is unavailable", { availability: "unsupported" }, {}],
      ["weight permission is missing", { permissionGranted: false }, {}],
      ["the time zone is not known", {}, { timeZone: null }],
      ["there is no provider", {}, { provider: null }],
    ] as const;

    it.each(earlyReturns)(
      "should leave both kinds not-run, and read, save and ask for nothing, when %s",
      async (_name, providerState, overrides) => {
        const { provider, importBodyMeasurements, anchorStore, dependencies } = setUp(
          { ...withBodyComposition, ...providerState },
          overrides,
        );

        const result = await runHealthImport(dependencies);

        expect(result.body).toEqual({ bodyFat: notRun, leanMass: notRun });
        expect(importBodyMeasurements).not.toHaveBeenCalled();
        expect(anchorStore.writes).toEqual([]);
        const methods = provider.calls.map((call) => call.method);
        expect(methods).not.toContain("readBodyCompositionSince");
        expect(methods).not.toContain("requestPermission");
        expect(methods).not.toContain("requestBodyCompositionPermission");
      },
    );

    it("should leave both kinds not-run when the permission check throws", async () => {
      const { provider, dependencies } = setUp({
        ...withBodyComposition,
        failures: { hasPermission: "failed" },
      });

      const result = await runHealthImport(dependencies);

      expect(result.status).toBe("failed");
      expect(result.body).toEqual({ bodyFat: notRun, leanMass: notRun });
      expect(provider.calls.map((call) => call.method)).not.toContain("readBodyCompositionSince");
    });
  });

  describe("single flight over the whole pass", () => {
    it("should read the weight and the body composition once each and give both callers the same result", async () => {
      const { provider, importWeighIns, importBodyMeasurements, dependencies } =
        setUp(withBodyComposition);

      const [firstResult, secondResult] = await Promise.all([
        runHealthImport(dependencies),
        runHealthImport(dependencies),
      ]);

      expect(sincesRead(provider)).toHaveLength(1);
      expect(
        provider.calls.filter((call) => call.method === "readBodyCompositionSince"),
      ).toHaveLength(1);
      expect(importWeighIns).toHaveBeenCalledTimes(1);
      expect(importBodyMeasurements).toHaveBeenCalledTimes(2);
      expect(secondResult).toBe(firstResult);
    });

    it("should join the running pass while the body step is still saving, then start a new one afterwards", async () => {
      const { provider, importBodyMeasurements, dependencies } = setUp(withBodyComposition);
      let finishBodyFatSave: (outcome: { inserted: number }) => void = () => undefined;
      importBodyMeasurements.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishBodyFatSave = resolve;
          }),
      );

      const running = runHealthImport(dependencies);
      await new Promise((resolve) => setImmediate(resolve));
      // The weight step is long finished, and the body step is mid-save.
      const joined = runHealthImport(dependencies);
      finishBodyFatSave({ inserted: 10 });
      const [runningResult, joinedResult] = await Promise.all([running, joined]);
      await runHealthImport(dependencies);

      expect(joinedResult).toBe(runningResult);
      expect(
        provider.calls.filter((call) => call.method === "readBodyCompositionSince"),
      ).toHaveLength(2);
      expect(sincesRead(provider)).toHaveLength(2);
    });
  });

  describe("body composition values in logs", () => {
    const consoleMethods = ["log", "info", "warn", "error"] as const;

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should write nothing holding a body fat value, a lean mass value or a sample id, whether a run works, fails, is refused or is skipped", async () => {
      const spies = consoleMethods.map((method) =>
        jest.spyOn(console, method).mockImplementation(),
      );
      const results = [];

      const works = setUp(withBodyComposition);
      results.push(await runHealthImport(works.dependencies));

      const savesFail = setUp(withBodyComposition);
      savesFail.importBodyMeasurements.mockRejectedValue(
        new Error("could not store fat-id-07 at 23.456 and lean-id-07 at 54.321"),
      );
      results.push(await runHealthImport(savesFail.dependencies));

      const readThrows = setUp(withBodyComposition);
      jest
        .spyOn(readThrows.provider, "readBodyCompositionSince")
        .mockRejectedValueOnce(new TypeError("23.456 54.321 fat-id-01"));
      results.push(await runHealthImport(readThrows.dependencies));

      const refused = setUp({
        ...withBodyComposition,
        bodyCompositionReadStatus: { bodyFat: "no-permission", leanMass: "failed" },
      });
      results.push(await runHealthImport(refused.dependencies));

      const skipped = setUp({ ...withBodyComposition, availability: "unsupported" });
      results.push(await runHealthImport(skipped.dependencies));

      const written = spies
        .flatMap((spy) => spy.mock.calls)
        .flat()
        .map(String)
        .join(" ");
      expect(written).not.toMatch(/81\.234|23\.456|54\.321|sample-id|fat-id|lean-id/);
      expect(JSON.stringify(results)).not.toMatch(
        /81\.234|23\.456|54\.321|sample-id|fat-id|lean-id/,
      );
    });
  });

  describe("health data in logs", () => {
    const consoleMethods = ["log", "info", "warn", "error"] as const;

    function spyOnConsole() {
      return consoleMethods.map((method) => jest.spyOn(console, method).mockImplementation());
    }

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should write nothing holding a weight or a sample id, whether a run works, fails or is skipped", async () => {
      const spies = spyOnConsole();
      const results = [];

      const works = setUp();
      results.push(await runHealthImport(works.dependencies));

      const saveFails = setUp();
      saveFails.importWeighIns.mockRejectedValueOnce(
        new Error("could not store sample-id-07 at 81.234"),
      );
      results.push(await runHealthImport(saveFails.dependencies));

      const readFails = setUp({ failures: { readWeightSince: "failed" } });
      results.push(await runHealthImport(readFails.dependencies));

      const skipped = setUp({ permissionGranted: false });
      results.push(await runHealthImport(skipped.dependencies));

      const written = spies
        .flatMap((spy) => spy.mock.calls)
        .flat()
        .map(String)
        .join(" ");
      expect(written).not.toMatch(/81\.234|sample-id/);
      expect(JSON.stringify(results)).not.toMatch(/81\.234|sample-id/);
    });
  });
});
