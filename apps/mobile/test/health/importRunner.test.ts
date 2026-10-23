import { HEALTH_IMPORT_OVERLAP_DAYS } from "@keylow/core/weight";

import { createInMemoryHealthAnchorStore } from "./inMemoryHealthAnchorStore";
import { runHealthImport } from "../../lib/health/importRunner";
import { createFakeHealthProvider } from "../support/fakeHealthProvider";

import type { HealthImportDependencies } from "../../lib/health/importRunner";
import type { FakeHealthProvider } from "../support/fakeHealthProvider";
import type { HealthWeighInInsert, HealthWeightSample } from "@keylow/core/weight";

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

function daysBefore(instant: string, days: number): string {
  return new Date(Date.parse(instant) - days * DAY_IN_MILLISECONDS).toISOString();
}

type Setup = {
  provider: FakeHealthProvider;
  anchorStore: ReturnType<typeof createInMemoryHealthAnchorStore>;
  importWeighIns: jest.Mock<Promise<{ inserted: number }>, [readonly HealthWeighInInsert[]]>;
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
  const dependencies: HealthImportDependencies = {
    userId,
    provider,
    anchorStore,
    timeZone,
    importWeighIns,
    now: () => now,
    ...overrides,
  };
  return { provider, anchorStore, importWeighIns, dependencies };
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
      expect(result).toEqual({ status: "imported", read: 20, skipped: 0, inserted: 20 });
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

      expect(result).toEqual({ status: "imported", read: 3, skipped: 5, inserted: 2 });
    });

    it("should report the rows the save stored as inserted, not the rows it was given", async () => {
      const { importWeighIns, dependencies } = setUp();
      importWeighIns.mockResolvedValueOnce({ inserted: 3 });

      const result = await runHealthImport(dependencies);

      expect(result).toEqual({ status: "imported", read: 20, skipped: 0, inserted: 3 });
    });

    it("should skip the save when no sample is usable, and still move the anchor past them", async () => {
      const { anchorStore, importWeighIns, dependencies } = setUp({
        samples: [sampleOn(2, { value: 5000 })],
      });

      const result = await runHealthImport(dependencies);

      expect(importWeighIns).not.toHaveBeenCalled();
      expect(result).toEqual({ status: "imported", read: 1, skipped: 1, inserted: 0 });
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

      expect(result).toEqual({ status: "nothing-new", read: 0, skipped: 0, inserted: 0 });
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
      const noPermission = setUp({ permissionGranted: false });
      const unavailable = setUp({ availability: "unsupported" });

      await runHealthImport(noPermission.dependencies);
      await runHealthImport(unavailable.dependencies);

      expect(noPermission.anchorStore.writes).toEqual([]);
      expect(unavailable.anchorStore.writes).toEqual([]);
    });
  });

  describe("a run that does not start", () => {
    it("should be unavailable, with no read, when there is no provider", async () => {
      const { importWeighIns, anchorStore, dependencies } = setUp();

      const result = await runHealthImport({ ...dependencies, provider: null });

      expect(result).toEqual({ status: "unavailable", read: 0, skipped: 0, inserted: 0 });
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

      expect(result).toEqual({ status: "no-permission", read: 0, skipped: 0, inserted: 0 });
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

      expect(result).toEqual({ status: "no-permission", read: 0, skipped: 0, inserted: 0 });
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
