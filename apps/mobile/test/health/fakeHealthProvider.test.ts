import { HealthProviderError } from "../../lib/health";
import { createFakeHealthProvider } from "../support/fakeHealthProvider";

import type {
  HealthBodyFatSample,
  HealthLeanMassSample,
  HealthWeightSample,
} from "@keylow/core/weight";

function sampleAt(measuredAt: string, sampleId = `id-${measuredAt}`): HealthWeightSample {
  return { sampleId, measuredAt, value: 81.234, unit: "kilograms" };
}

function bodyFatAt(measuredAt: string): HealthBodyFatSample {
  return { sampleId: `fat-${measuredAt}`, measuredAt, value: 23.456 };
}

function leanMassAt(measuredAt: string): HealthLeanMassSample {
  return { sampleId: `lean-${measuredAt}`, measuredAt, value: 54.321, unit: "kilograms" };
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

  describe("body composition permission", () => {
    it("should have no body composition access by default, and never prompt to find out", async () => {
      const fake = createFakeHealthProvider();

      await expect(fake.bodyCompositionAccess()).resolves.toEqual({
        bodyFat: false,
        leanMass: false,
      });
      expect(fake.calls).toEqual([{ method: "bodyCompositionAccess" }]);
    });

    it("should start with the access it is given", async () => {
      const fake = createFakeHealthProvider({
        bodyCompositionAccess: { bodyFat: true, leanMass: false },
      });

      await expect(fake.bodyCompositionAccess()).resolves.toEqual({
        bodyFat: true,
        leanMass: false,
      });
    });

    it("should grant both kinds when only body composition is requested", async () => {
      const fake = createFakeHealthProvider();

      await expect(fake.requestBodyCompositionPermission()).resolves.toEqual({
        bodyFat: true,
        leanMass: true,
      });
      await expect(fake.bodyCompositionAccess()).resolves.toEqual({
        bodyFat: true,
        leanMass: true,
      });
      expect(fake.state.permissionGranted).toBe(false);
    });

    it("should grant only the kinds it is set to grant on a request", async () => {
      const fake = createFakeHealthProvider({
        grantBodyCompositionOnRequest: { bodyFat: false, leanMass: true },
      });

      await expect(fake.requestBodyCompositionPermission()).resolves.toEqual({
        bodyFat: false,
        leanMass: true,
      });
    });

    it("should not grant body composition when permission is requested with no option", async () => {
      const fake = createFakeHealthProvider();

      await fake.requestPermission();

      await expect(fake.bodyCompositionAccess()).resolves.toEqual({
        bodyFat: false,
        leanMass: false,
      });
    });

    it("should grant weight and body composition when permission is requested with the option", async () => {
      const fake = createFakeHealthProvider();

      await expect(fake.requestPermission({ includeBodyComposition: true })).resolves.toBe(
        "granted",
      );

      await expect(fake.hasPermission()).resolves.toBe(true);
      await expect(fake.bodyCompositionAccess()).resolves.toEqual({
        bodyFat: true,
        leanMass: true,
      });
    });

    it("should throw the scripted error when body composition is requested", async () => {
      const fake = createFakeHealthProvider({
        failures: { requestBodyCompositionPermission: "failed" },
      });

      await expect(fake.requestBodyCompositionPermission()).rejects.toEqual(
        new HealthProviderError("requestBodyCompositionPermission", "failed"),
      );
    });
  });

  describe("readBodyCompositionSince", () => {
    const noStart = { bodyFat: null, leanMass: null };
    const bothGranted = { bodyFat: true, leanMass: true };

    it("should read each kind from its own start, oldest first", async () => {
      const fake = createFakeHealthProvider({
        bodyCompositionAccess: bothGranted,
        bodyFatSamples: [
          bodyFatAt("2026-10-03T07:00:00Z"),
          bodyFatAt("2026-10-01T07:00:00Z"),
          bodyFatAt("2026-10-02T07:00:00Z"),
        ],
        leanMassSamples: [leanMassAt("2026-10-01T07:00:00Z"), leanMassAt("2026-10-02T07:00:00Z")],
      });

      const read = await fake.readBodyCompositionSince({
        bodyFat: "2026-10-02T07:00:00Z",
        leanMass: null,
      });

      expect(read).toEqual({
        bodyFat: {
          status: "read",
          samples: [bodyFatAt("2026-10-02T07:00:00Z"), bodyFatAt("2026-10-03T07:00:00Z")],
          newestSampleAt: "2026-10-03T07:00:00Z",
          skippedRecords: 0,
        },
        leanMass: {
          status: "read",
          samples: [leanMassAt("2026-10-01T07:00:00Z"), leanMassAt("2026-10-02T07:00:00Z")],
          newestSampleAt: "2026-10-02T07:00:00Z",
          skippedRecords: 0,
        },
      });
    });

    it("should report no-permission for a kind that is not granted and still read the other", async () => {
      const fake = createFakeHealthProvider({
        bodyCompositionAccess: { bodyFat: false, leanMass: true },
        bodyFatSamples: [bodyFatAt("2026-10-01T07:00:00Z")],
        leanMassSamples: [leanMassAt("2026-10-01T07:00:00Z")],
      });

      const read = await fake.readBodyCompositionSince(noStart);

      expect(read.bodyFat).toEqual({ status: "no-permission" });
      expect(read.leanMass.status).toBe("read");
    });

    it.each(["failed", "no-permission"] as const)(
      "should answer %s for the kind it is scripted to and leave the other alone",
      async (status) => {
        const fake = createFakeHealthProvider({
          bodyCompositionAccess: bothGranted,
          bodyFatSamples: [bodyFatAt("2026-10-01T07:00:00Z")],
          leanMassSamples: [leanMassAt("2026-10-01T07:00:00Z")],
          bodyCompositionReadStatus: { leanMass: status },
        });

        const read = await fake.readBodyCompositionSince(noStart);

        expect(read.bodyFat.status).toBe("read");
        expect(read.leanMass).toEqual({ status });
      },
    );

    it("should report the skipped records count it is set to for each kind", async () => {
      const fake = createFakeHealthProvider({
        bodyCompositionAccess: bothGranted,
        bodyCompositionSkippedRecords: { bodyFat: 2, leanMass: 1 },
      });

      const read = await fake.readBodyCompositionSince(noStart);

      expect(read.bodyFat).toMatchObject({ status: "read", skippedRecords: 2 });
      expect(read.leanMass).toMatchObject({ status: "read", skippedRecords: 1 });
    });

    it("should never throw, even when a failure is scripted for its action", async () => {
      const fake = createFakeHealthProvider({
        bodyCompositionAccess: bothGranted,
        failures: { readBodyCompositionSince: "failed", bodyCompositionAccess: "failed" },
      });

      await expect(fake.readBodyCompositionSince(noStart)).resolves.toMatchObject({
        bodyFat: { status: "read" },
      });
      await expect(fake.bodyCompositionAccess()).resolves.toEqual(bothGranted);
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

    it("should record the body composition calls with the starts of a read", async () => {
      const fake = createFakeHealthProvider();
      const since = { bodyFat: "2026-10-01T00:00:00Z", leanMass: null };

      await fake.bodyCompositionAccess();
      await fake.requestBodyCompositionPermission();
      await fake.requestPermission({ includeBodyComposition: true });
      await fake.readBodyCompositionSince(since);

      expect(fake.calls).toEqual([
        { method: "bodyCompositionAccess" },
        { method: "requestBodyCompositionPermission" },
        { method: "requestPermission", includeBodyComposition: true },
        { method: "readBodyCompositionSince", since },
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
