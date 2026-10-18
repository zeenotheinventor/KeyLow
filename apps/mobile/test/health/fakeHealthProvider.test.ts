import { HealthProviderError } from "../../lib/health";
import { createFakeHealthProvider } from "../support/fakeHealthProvider";

import type { HealthWeightSample } from "@keylow/core/weight";

function sampleAt(measuredAt: string, sampleId = `id-${measuredAt}`): HealthWeightSample {
  return { sampleId, measuredAt, value: 81.234, unit: "kilograms" };
}

describe("createFakeHealthProvider", () => {
  describe("availability", () => {
    it("should be available by default", async () => {
      const fake = createFakeHealthProvider();

      await expect(fake.availability()).resolves.toBe("available");
      await expect(fake.isAvailable()).resolves.toBe(true);
    });

    it.each(["needs-install", "unsupported"] as const)(
      "should report %s as not available",
      async (availability) => {
        const fake = createFakeHealthProvider({ availability });

        await expect(fake.availability()).resolves.toBe(availability);
        await expect(fake.isAvailable()).resolves.toBe(false);
      },
    );
  });

  describe("permission", () => {
    it("should not have permission until it is requested", async () => {
      const fake = createFakeHealthProvider();

      await expect(fake.hasPermission()).resolves.toBe(false);
    });

    it("should grant permission when requested", async () => {
      const fake = createFakeHealthProvider();

      await expect(fake.requestPermission()).resolves.toBe("granted");
      await expect(fake.hasPermission()).resolves.toBe(true);
    });

    it("should deny permission when the request is set to be denied", async () => {
      const fake = createFakeHealthProvider({ grantOnRequest: false });

      await expect(fake.requestPermission()).resolves.toBe("denied");
      await expect(fake.hasPermission()).resolves.toBe(false);
    });

    it("should start with permission when it is set granted", async () => {
      const fake = createFakeHealthProvider({ permissionGranted: true });

      await expect(fake.hasPermission()).resolves.toBe(true);
    });
  });

  describe("readWeightSince", () => {
    const samples = [
      sampleAt("2026-10-03T07:30:00Z"),
      sampleAt("2026-10-01T07:30:00Z"),
      sampleAt("2026-10-02T07:30:00.500Z"),
    ];

    it("should return every sample oldest first when there is no anchor", async () => {
      const fake = createFakeHealthProvider({ samples });

      const read = await fake.readWeightSince(null);

      expect(read.samples.map((sample) => sample.measuredAt)).toEqual([
        "2026-10-01T07:30:00Z",
        "2026-10-02T07:30:00.500Z",
        "2026-10-03T07:30:00Z",
      ]);
      expect(read.newestSampleAt).toBe("2026-10-03T07:30:00Z");
    });

    it("should return only samples at or after the anchor", async () => {
      const fake = createFakeHealthProvider({ samples });

      const read = await fake.readWeightSince("2026-10-02T07:30:00.500Z");

      expect(read.samples.map((sample) => sample.measuredAt)).toEqual([
        "2026-10-02T07:30:00.500Z",
        "2026-10-03T07:30:00Z",
      ]);
    });

    it("should have no newest sample time when nothing is returned", async () => {
      const fake = createFakeHealthProvider({ samples });

      await expect(fake.readWeightSince("2026-11-01T00:00:00Z")).resolves.toEqual({
        samples: [],
        newestSampleAt: null,
        skippedRecords: 0,
      });
    });

    it("should report the skipped records count it is set to", async () => {
      const fake = createFakeHealthProvider({ skippedRecords: 3 });

      const read = await fake.readWeightSince(null);

      expect(read.skippedRecords).toBe(3);
    });

    it("should pick up samples set after it was created", async () => {
      const fake = createFakeHealthProvider();
      fake.state.samples = [sampleAt("2026-10-01T07:30:00Z")];

      const read = await fake.readWeightSince(null);

      expect(read.samples).toHaveLength(1);
    });
  });

  describe("failures", () => {
    it("should throw the configured error for the failing action only", async () => {
      const fake = createFakeHealthProvider({ failures: { readWeightSince: "permission" } });

      await expect(fake.readWeightSince(null)).rejects.toEqual(
        new HealthProviderError("readWeightSince", "permission"),
      );
      await expect(fake.hasPermission()).resolves.toBe(false);
    });

    it("should stop failing once the failure is cleared", async () => {
      const fake = createFakeHealthProvider({ failures: { requestPermission: "failed" } });
      await expect(fake.requestPermission()).rejects.toBeInstanceOf(HealthProviderError);

      delete fake.state.failures.requestPermission;

      await expect(fake.requestPermission()).resolves.toBe("granted");
    });
  });

  describe("recorded calls", () => {
    it("should record each call in order, with the anchor of a read", async () => {
      const fake = createFakeHealthProvider();

      await fake.availability();
      await fake.requestPermission();
      await fake.readWeightSince("2026-10-01T00:00:00Z");
      await fake.readWeightSince(null);
      await fake.openInstallPage();
      await fake.openSettings();

      expect(fake.calls).toEqual([
        { method: "availability" },
        { method: "requestPermission" },
        { method: "readWeightSince", since: "2026-10-01T00:00:00Z" },
        { method: "readWeightSince", since: null },
        { method: "openInstallPage" },
        { method: "openSettings" },
      ]);
    });

    it("should record a call that fails", async () => {
      const fake = createFakeHealthProvider({ failures: { openSettings: "failed" } });

      await expect(fake.openSettings()).rejects.toBeInstanceOf(HealthProviderError);

      expect(fake.calls).toEqual([{ method: "openSettings" }]);
    });

    it("should record isAvailable and hasPermission as their own calls", async () => {
      const fake = createFakeHealthProvider();

      await fake.isAvailable();
      await fake.hasPermission();

      expect(fake.calls).toEqual([{ method: "isAvailable" }, { method: "hasPermission" }]);
    });
  });
});
