import { mapHealthSample } from "@keylow/core/weight";
import { Linking, Platform } from "react-native";
import {
  DeviceType,
  RecordingMethod,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
} from "react-native-health-connect";

import { HealthProviderError } from "../../lib/health";
import { getHealthProvider } from "../../lib/health/getHealthProvider";
import { createHealthConnectProvider } from "../../lib/health/healthConnectProvider";

jest.mock("react-native-health-connect");

const mockedGetSdkStatus = jest.mocked(getSdkStatus);
const mockedInitialize = jest.mocked(initialize);
const mockedGetGrantedPermissions = jest.mocked(getGrantedPermissions);
const mockedRequestPermission = jest.mocked(requestPermission);
const mockedReadRecords = jest.mocked(readRecords);
const mockedOpenSettings = jest.mocked(openHealthConnectSettings);

const SDK_UNAVAILABLE = 1;
const SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED = 2;
const SDK_AVAILABLE = 3;

const now = new Date("2026-10-18T12:00:00.000Z");
const dayInMilliseconds = 24 * 60 * 60 * 1000;
const isoDaysBeforeNow = (days: number) =>
  new Date(now.getTime() - days * dayInMilliseconds).toISOString();

const weightReadPermission = { accessType: "read", recordType: "Weight" } as const;
const bodyFatReadPermission = { accessType: "read", recordType: "BodyFat" } as const;
const leanMassReadPermission = { accessType: "read", recordType: "LeanBodyMass" } as const;

/** Shaped like the native read path: `massToJsMap` for the weight and `convertMetadataToJSMap` for the rest. */
function nativeWeightRecord(sampleId: string | undefined, time: string, kilograms: number) {
  return {
    time,
    zoneOffset: { id: "Europe/London", totalSeconds: 3600 },
    weight: {
      inGrams: kilograms * 1000,
      inKilograms: kilograms,
      inMilligrams: kilograms * 1_000_000,
      inMicrograms: kilograms * 1_000_000_000,
      inOunces: kilograms * 35.27396,
      inPounds: kilograms * 2.2046226,
    },
    metadata: {
      ...(sampleId === undefined ? {} : { id: sampleId }),
      clientRecordId: "client-record",
      clientRecordVersion: 0,
      dataOrigin: "com.example.scale",
      lastModifiedTime: "2026-10-17T08:00:00.123Z",
      device: { type: DeviceType.TYPE_SCALE, manufacturer: "Acme", model: "Scale 2" },
      recordingMethod: RecordingMethod.RECORDING_METHOD_ACTIVELY_RECORDED,
      manufacturer: "Acme",
      model: "Scale 2",
    },
    foo: "extra",
  };
}

const recordMetadata = (sampleId: string | undefined) => ({
  ...(sampleId === undefined ? {} : { id: sampleId }),
  clientRecordId: "client-record",
  clientRecordVersion: 0,
  dataOrigin: "com.example.scale",
  lastModifiedTime: "2026-10-17T08:00:00.123Z",
  device: { type: DeviceType.TYPE_SCALE, manufacturer: "Acme", model: "Scale 2" },
  recordingMethod: RecordingMethod.RECORDING_METHOD_ACTIVELY_RECORDED,
  manufacturer: "Acme",
  model: "Scale 2",
});

/** Shaped like `ReactBodyFatRecord.parseRecord`. */
function nativeBodyFatRecord(sampleId: string | undefined, time: string, percentage: number) {
  return {
    time,
    zoneOffset: { id: "Europe/London", totalSeconds: 3600 },
    percentage,
    metadata: recordMetadata(sampleId),
    foo: "extra",
  };
}

/** Shaped like `ReactLeanBodyMassRecord.parseRecord`, whose mass comes from `massToJsMap`. */
function nativeLeanMassRecord(sampleId: string | undefined, time: string, kilograms: number) {
  return {
    time,
    zoneOffset: { id: "Europe/London", totalSeconds: 3600 },
    mass: {
      inGrams: kilograms * 1000,
      inKilograms: kilograms,
      inMilligrams: kilograms * 1_000_000,
      inMicrograms: kilograms * 1_000_000_000,
      inOunces: kilograms * 35.27396,
      inPounds: kilograms * 2.2046226,
    },
    metadata: recordMetadata(sampleId),
    foo: "extra",
  };
}

function createProvider() {
  return createHealthConnectProvider({ now: () => now });
}

function startTimeOf(callNumber: number): string | undefined {
  const [, options] = mockedReadRecords.mock.calls[callNumber - 1] ?? [];
  return options?.timeRangeFilter.operator === "after"
    ? options.timeRangeFilter.startTime
    : undefined;
}

beforeEach(() => {
  jest.resetAllMocks();
  mockedInitialize.mockResolvedValue(true);
  mockedGetGrantedPermissions.mockResolvedValue([]);
  mockedReadRecords.mockResolvedValue({ records: [] });
});

describe("availability", () => {
  it.each([
    [SDK_AVAILABLE, "available"],
    [SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED, "needs-install"],
    [SDK_UNAVAILABLE, "unsupported"],
  ] as const)("should map SDK status %i to %s", async (status, expected) => {
    mockedGetSdkStatus.mockResolvedValue(status);

    await expect(createProvider().availability()).resolves.toBe(expected);
  });

  it("should report unsupported when the library throws", async () => {
    mockedGetSdkStatus.mockRejectedValue(new Error("secret detail 81.234"));

    await expect(createProvider().availability()).resolves.toBe("unsupported");
  });

  it("should be available only for the available status", async () => {
    mockedGetSdkStatus.mockResolvedValueOnce(SDK_AVAILABLE);
    mockedGetSdkStatus.mockResolvedValueOnce(SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED);

    const provider = createProvider();

    await expect(provider.isAvailable()).resolves.toBe(true);
    await expect(provider.isAvailable()).resolves.toBe(false);
  });
});

describe("permission", () => {
  it("should have permission when the granted list holds weight read access", async () => {
    mockedGetGrantedPermissions.mockResolvedValue([weightReadPermission]);

    await expect(createProvider().hasPermission()).resolves.toBe(true);
  });

  it.each([
    ["nothing is granted", []],
    ["only weight write access is granted", [{ accessType: "write", recordType: "Weight" }]],
    ["only another record type is granted", [{ accessType: "read", recordType: "Steps" }]],
  ] as const)("should not have permission when %s", async (_description, granted) => {
    mockedGetGrantedPermissions.mockResolvedValue([...granted]);

    await expect(createProvider().hasPermission()).resolves.toBe(false);
  });

  it("should never prompt when checking", async () => {
    mockedGetGrantedPermissions.mockResolvedValue([]);

    await createProvider().hasPermission();

    expect(mockedRequestPermission).not.toHaveBeenCalled();
  });

  it("should initialise the library once, before its first use", async () => {
    const provider = createProvider();

    await provider.hasPermission();
    await provider.hasPermission();

    expect(mockedInitialize).toHaveBeenCalledTimes(1);
    expect(mockedInitialize.mock.invocationCallOrder[0]).toBeLessThan(
      mockedGetGrantedPermissions.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("should ask for weight read access only", async () => {
    mockedRequestPermission.mockResolvedValue([weightReadPermission]);

    await createProvider().requestPermission();

    expect(mockedRequestPermission).toHaveBeenCalledWith([weightReadPermission]);
  });

  it("should return granted when the returned list holds weight read access", async () => {
    mockedRequestPermission.mockResolvedValue([weightReadPermission]);

    await expect(createProvider().requestPermission()).resolves.toBe("granted");
  });

  it("should return denied when the returned list does not hold it", async () => {
    mockedRequestPermission.mockResolvedValue([]);

    await expect(createProvider().requestPermission()).resolves.toBe("denied");
  });

  it("should throw a failed error when initialising fails, keeping the library message out", async () => {
    mockedInitialize.mockRejectedValue(new Error("secret detail 81.234"));

    const failure = await createProvider()
      .hasPermission()
      .catch((error: unknown) => error);

    expect(failure).toEqual(new HealthProviderError("hasPermission", "failed"));
  });

  it("should initialise again after a failed attempt", async () => {
    mockedInitialize.mockRejectedValueOnce(new Error("not ready"));
    const provider = createProvider();
    await provider.hasPermission().catch(() => undefined);

    await provider.hasPermission();

    expect(mockedInitialize).toHaveBeenCalledTimes(2);
  });
});

describe("body composition permission", () => {
  describe("bodyCompositionAccess", () => {
    it.each([
      [[], { bodyFat: false, leanMass: false }],
      [[bodyFatReadPermission], { bodyFat: true, leanMass: false }],
      [[leanMassReadPermission], { bodyFat: false, leanMass: true }],
      [[bodyFatReadPermission, leanMassReadPermission], { bodyFat: true, leanMass: true }],
    ] as const)("should read %j from the granted list as %j", async (granted, expected) => {
      mockedGetGrantedPermissions.mockResolvedValue([...granted]);

      await expect(createProvider().bodyCompositionAccess()).resolves.toEqual(expected);
    });

    it("should ignore weight access and write access", async () => {
      mockedGetGrantedPermissions.mockResolvedValue([
        weightReadPermission,
        { accessType: "write", recordType: "BodyFat" },
        { accessType: "write", recordType: "LeanBodyMass" },
      ]);

      await expect(createProvider().bodyCompositionAccess()).resolves.toEqual({
        bodyFat: false,
        leanMass: false,
      });
    });

    it("should never prompt", async () => {
      mockedGetGrantedPermissions.mockResolvedValue([bodyFatReadPermission]);

      await createProvider().bodyCompositionAccess();

      expect(mockedRequestPermission).not.toHaveBeenCalled();
    });

    it("should read as nothing granted when the library throws", async () => {
      mockedGetGrantedPermissions.mockRejectedValue(new Error("secret detail 81.234"));

      await expect(createProvider().bodyCompositionAccess()).resolves.toEqual({
        bodyFat: false,
        leanMass: false,
      });
    });

    it("should read as nothing granted when initialising fails", async () => {
      mockedInitialize.mockRejectedValue(new Error("not ready"));

      await expect(createProvider().bodyCompositionAccess()).resolves.toEqual({
        bodyFat: false,
        leanMass: false,
      });
    });
  });

  describe("requestPermission with body composition", () => {
    it("should ask for weight alone when given no option", async () => {
      mockedRequestPermission.mockResolvedValue([weightReadPermission]);

      await createProvider().requestPermission();

      expect(mockedRequestPermission).toHaveBeenCalledWith([weightReadPermission]);
    });

    it("should ask for weight alone when the option is false", async () => {
      mockedRequestPermission.mockResolvedValue([weightReadPermission]);

      await createProvider().requestPermission({ includeBodyComposition: false });

      expect(mockedRequestPermission).toHaveBeenCalledWith([weightReadPermission]);
    });

    it("should ask for weight, body fat and lean mass in one request when asked to include them", async () => {
      mockedRequestPermission.mockResolvedValue([weightReadPermission]);

      await createProvider().requestPermission({ includeBodyComposition: true });

      expect(mockedRequestPermission).toHaveBeenCalledTimes(1);
      expect(mockedRequestPermission).toHaveBeenCalledWith([
        weightReadPermission,
        bodyFatReadPermission,
        leanMassReadPermission,
      ]);
    });

    it("should answer granted for weight alone even when the two new types are not granted", async () => {
      mockedRequestPermission.mockResolvedValue([weightReadPermission]);

      await expect(
        createProvider().requestPermission({ includeBodyComposition: true }),
      ).resolves.toBe("granted");
    });

    it("should answer denied when weight is not granted, even if the new types are", async () => {
      mockedRequestPermission.mockResolvedValue([bodyFatReadPermission, leanMassReadPermission]);

      await expect(
        createProvider().requestPermission({ includeBodyComposition: true }),
      ).resolves.toBe("denied");
    });

    it("should throw a failed error that holds nothing from the library", async () => {
      mockedRequestPermission.mockRejectedValue(new Error("secret detail 81.234"));

      const failure = await createProvider()
        .requestPermission({ includeBodyComposition: true })
        .catch((error: unknown) => error);

      expect(failure).toEqual(new HealthProviderError("requestPermission", "failed"));
    });
  });

  describe("requestBodyCompositionPermission", () => {
    it("should ask for body fat and lean mass only", async () => {
      mockedRequestPermission.mockResolvedValue([]);

      await createProvider().requestBodyCompositionPermission();

      expect(mockedRequestPermission).toHaveBeenCalledTimes(1);
      expect(mockedRequestPermission).toHaveBeenCalledWith([
        bodyFatReadPermission,
        leanMassReadPermission,
      ]);
    });

    it.each([
      [[], { bodyFat: false, leanMass: false }],
      [[bodyFatReadPermission], { bodyFat: true, leanMass: false }],
      [[leanMassReadPermission], { bodyFat: false, leanMass: true }],
      [[bodyFatReadPermission, leanMassReadPermission], { bodyFat: true, leanMass: true }],
    ] as const)("should resolve %j to %j", async (granted, expected) => {
      mockedRequestPermission.mockResolvedValue([...granted]);

      await expect(createProvider().requestBodyCompositionPermission()).resolves.toEqual(expected);
    });

    it("should throw a failed error that holds nothing from the library", async () => {
      mockedRequestPermission.mockRejectedValue(new Error("secret detail 81.234"));

      const failure = await createProvider()
        .requestBodyCompositionPermission()
        .catch((error: unknown) => error);

      expect(failure).toEqual(
        new HealthProviderError("requestBodyCompositionPermission", "failed"),
      );
    });
  });

  it("should still treat weight alone as connected", async () => {
    mockedGetGrantedPermissions.mockResolvedValue([weightReadPermission]);

    await expect(createProvider().hasPermission()).resolves.toBe(true);
  });

  it("should not treat body composition alone as connected", async () => {
    mockedGetGrantedPermissions.mockResolvedValue([bodyFatReadPermission, leanMassReadPermission]);

    await expect(createProvider().hasPermission()).resolves.toBe(false);
  });
});

describe("readWeightSince", () => {
  it("should ask for a window starting 365 days before now when there is no anchor", async () => {
    await createProvider().readWeightSince(null);

    expect(mockedReadRecords).toHaveBeenCalledTimes(1);
    expect(startTimeOf(1)).toBe(isoDaysBeforeNow(365));
  });

  it("should ask for exactly the anchor it is given", async () => {
    await createProvider().readWeightSince("2026-10-10T06:15:30.250Z");

    expect(startTimeOf(1)).toBe("2026-10-10T06:15:30.250Z");
  });

  it("should read weight oldest first, one page at a time", async () => {
    await createProvider().readWeightSince(null);

    expect(mockedReadRecords).toHaveBeenCalledWith("Weight", {
      timeRangeFilter: { operator: "after", startTime: isoDaysBeforeNow(365) },
      ascendingOrder: true,
      pageSize: 1000,
    });
  });

  it("should follow page tokens and join the pages in order", async () => {
    mockedReadRecords
      .mockResolvedValueOnce({
        records: [nativeWeightRecord("a", "2026-10-01T07:00:00Z", 80)],
        pageToken: "token-1",
      })
      .mockResolvedValueOnce({
        records: [nativeWeightRecord("b", "2026-10-02T07:00:00Z", 81)],
        pageToken: "token-2",
      })
      .mockResolvedValueOnce({ records: [nativeWeightRecord("c", "2026-10-03T07:00:00Z", 82)] });

    const read = await createProvider().readWeightSince(null);

    expect(read.samples.map((sample) => sample.sampleId)).toEqual(["a", "b", "c"]);
    expect(mockedReadRecords.mock.calls.map(([, options]) => options.pageToken)).toEqual([
      undefined,
      "token-1",
      "token-2",
    ]);
  });

  it("should stop at a null page token, which is what the native module sends on the last page", async () => {
    // The native module sends a null here, which the library's types do not allow for, so the
    // page is built the way the bridge delivers it, by parsing JSON.
    const lastPage = JSON.stringify({
      records: [nativeWeightRecord("a", "2026-10-01T07:00:00Z", 80)],
      pageToken: null,
    });
    mockedReadRecords.mockImplementation(() => Promise.resolve(JSON.parse(lastPage)));

    await createProvider().readWeightSince(null);

    expect(mockedReadRecords).toHaveBeenCalledTimes(1);
  });

  it("should throw instead of looping when a page repeats the token it was asked with", async () => {
    mockedReadRecords.mockResolvedValue({
      records: [nativeWeightRecord("a", "2026-10-01T07:00:00Z", 80)],
      pageToken: "stuck",
    });

    await expect(createProvider().readWeightSince("2026-10-01T00:00:00Z")).rejects.toEqual(
      new HealthProviderError("readWeightSince", "failed"),
    );
    expect(mockedReadRecords).toHaveBeenCalledTimes(2);
  });

  it("should keep exactly the four allowed fields of each record", async () => {
    mockedReadRecords.mockResolvedValue({
      records: [nativeWeightRecord("sample-1", "2026-10-01T07:00:00.123Z", 81.234)],
    });

    const read = await createProvider().readWeightSince(null);

    expect(read.samples).toEqual([
      {
        sampleId: "sample-1",
        measuredAt: "2026-10-01T07:00:00.123Z",
        value: 81.234,
        unit: "kilograms",
      },
    ]);
    expect(Object.keys(read.samples[0] ?? {}).sort()).toEqual([
      "measuredAt",
      "sampleId",
      "unit",
      "value",
    ]);
  });

  it("should give the right kilograms once core maps a sample", async () => {
    mockedReadRecords.mockResolvedValue({
      records: [nativeWeightRecord("sample-1", "2026-10-01T07:00:00.123456789Z", 81.234)],
    });

    const read = await createProvider().readWeightSince(null);
    const row = read.samples[0] && mapHealthSample(read.samples[0], { timeZone: "Europe/London" });

    expect(row).toMatchObject({
      weight_kg: 81.234,
      source: "health_connect",
      external_id: "sample-1",
    });
  });

  it("should skip and count a record with no id, no time or no usable weight", async () => {
    const good = nativeWeightRecord("good", "2026-10-01T07:00:00Z", 80);
    const noId = nativeWeightRecord(undefined, "2026-10-02T07:00:00Z", 80);
    const noTime = nativeWeightRecord("y", "", 80);
    const noWeight = nativeWeightRecord("z", "2026-10-03T07:00:00Z", Number.NaN);
    mockedReadRecords.mockResolvedValue({
      records: [good, noId, noTime, noWeight],
    });

    const read = await createProvider().readWeightSince(null);

    expect(read.samples.map((sample) => sample.sampleId)).toEqual(["good"]);
    expect(read.skippedRecords).toBe(3);
  });

  it("should report the latest time returned as the newest sample time", async () => {
    mockedReadRecords
      .mockResolvedValueOnce({
        records: [nativeWeightRecord("a", "2026-10-01T07:00:00Z", 80)],
        pageToken: "token-1",
      })
      .mockResolvedValueOnce({
        records: [
          nativeWeightRecord("b", "2026-10-02T07:00:00Z", 81),
          nativeWeightRecord("c", "2026-10-03T07:00:00.500Z", 82),
        ],
      });

    const read = await createProvider().readWeightSince(null);

    expect(read.newestSampleAt).toBe("2026-10-03T07:00:00.500Z");
  });

  it("should report no newest sample time and no skips for an empty read", async () => {
    await expect(createProvider().readWeightSince(null)).resolves.toEqual({
      samples: [],
      newestSampleAt: null,
      skippedRecords: 0,
    });
  });

  describe("the 30 day history limit", () => {
    const olderThanLimit = (startTime: string) =>
      Date.parse(startTime) < now.getTime() - 30 * dayInMilliseconds;

    function refuseWindowsOlderThanLimit() {
      mockedReadRecords.mockImplementation((_recordType, options) => {
        const startTime =
          options.timeRangeFilter.operator === "after" ? options.timeRangeFilter.startTime : "";
        return olderThanLimit(startTime)
          ? Promise.reject(Object.assign(new Error("refused"), { code: "PERMISSION_ERROR" }))
          : Promise.resolve({
              records: [nativeWeightRecord("recent", "2026-10-10T07:00:00Z", 81.234)],
            });
      });
    }

    it("should retry once from 30 days before now when the first read is refused", async () => {
      refuseWindowsOlderThanLimit();

      const read = await createProvider().readWeightSince(null);

      expect(read.samples.map((sample) => sample.sampleId)).toEqual(["recent"]);
      expect(mockedReadRecords).toHaveBeenCalledTimes(2);
      expect(startTimeOf(1)).toBe(isoDaysBeforeNow(365));
      expect(startTimeOf(2)).toBe(isoDaysBeforeNow(30));
    });

    it("should not clamp when the library returns the whole window", async () => {
      mockedReadRecords.mockResolvedValue({
        records: [nativeWeightRecord("old", "2026-01-10T07:00:00Z", 85)],
      });

      const read = await createProvider().readWeightSince(null);

      expect(read.samples).toHaveLength(1);
      expect(mockedReadRecords).toHaveBeenCalledTimes(1);
    });

    it("should not retry when a later page of the first read is refused", async () => {
      mockedReadRecords
        .mockResolvedValueOnce({
          records: [nativeWeightRecord("old", "2026-01-10T07:00:00Z", 85)],
          pageToken: "token-1",
        })
        .mockRejectedValueOnce(new Error("down"));

      const failure = await createProvider()
        .readWeightSince(null)
        .catch((error: unknown) => error);

      expect(failure).toEqual(new HealthProviderError("readWeightSince", "failed"));
      expect(mockedReadRecords).toHaveBeenCalledTimes(2);
    });

    it("should not retry when a later page is refused for want of access", async () => {
      mockedReadRecords
        .mockResolvedValueOnce({
          records: [nativeWeightRecord("old", "2026-01-10T07:00:00Z", 85)],
          pageToken: "token-1",
        })
        .mockRejectedValueOnce(Object.assign(new Error("revoked"), { code: "PERMISSION_ERROR" }));

      await expect(createProvider().readWeightSince(null)).rejects.toEqual(
        new HealthProviderError("readWeightSince", "permission"),
      );
      expect(mockedReadRecords).toHaveBeenCalledTimes(2);
    });

    it("should throw a failed error when the retry is refused too", async () => {
      mockedReadRecords.mockRejectedValue(new Error("down"));

      const failure = await createProvider()
        .readWeightSince(null)
        .catch((error: unknown) => error);

      expect(failure).toEqual(new HealthProviderError("readWeightSince", "failed"));
      expect(mockedReadRecords).toHaveBeenCalledTimes(2);
    });

    it("should throw a permission error when the retry is refused for want of access", async () => {
      mockedReadRecords.mockRejectedValue(
        Object.assign(new Error("revoked"), { code: "PERMISSION_ERROR" }),
      );

      const failure = await createProvider()
        .readWeightSince(null)
        .catch((error: unknown) => error);

      expect(failure).toEqual(new HealthProviderError("readWeightSince", "permission"));
    });

    it("should never alter an anchor, even one older than the limit", async () => {
      refuseWindowsOlderThanLimit();
      const anchor = isoDaysBeforeNow(60);

      await expect(createProvider().readWeightSince(anchor)).rejects.toBeInstanceOf(
        HealthProviderError,
      );

      expect(mockedReadRecords).toHaveBeenCalledTimes(1);
      expect(startTimeOf(1)).toBe(anchor);
    });
  });

  describe("health data handling", () => {
    const consoleMethods = ["log", "warn", "error", "info"] as const;

    it("should write nothing to the console while reading", async () => {
      const spies = consoleMethods.map((method) =>
        jest.spyOn(console, method).mockImplementation(() => undefined),
      );
      mockedReadRecords.mockResolvedValue({
        records: [nativeWeightRecord("sample-1", "2026-10-01T07:00:00Z", 81.234)],
      });

      await createProvider().readWeightSince(null);

      spies.forEach((spy) => {
        expect(spy).not.toHaveBeenCalled();
      });
    });

    it("should write nothing to the console when a read fails", async () => {
      const spies = consoleMethods.map((method) =>
        jest.spyOn(console, method).mockImplementation(() => undefined),
      );
      mockedReadRecords.mockRejectedValue(new Error("sample-1 weighed 81.234"));

      await createProvider()
        .readWeightSince(null)
        .catch(() => undefined);

      spies.forEach((spy) => {
        expect(spy).not.toHaveBeenCalled();
      });
    });

    it("should throw an error that holds neither a weight nor a sample id", async () => {
      mockedReadRecords.mockRejectedValue(new Error("sample-1 weighed 81.234"));

      const failure = await createProvider()
        .readWeightSince(null)
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(HealthProviderError);
      expect(String(failure)).not.toContain("81.234");
      expect(String(failure)).not.toContain("sample-1");
    });
  });
});

describe("readBodyCompositionSince", () => {
  const bothGranted = [bodyFatReadPermission, leanMassReadPermission];
  const noStart = { bodyFat: null, leanMass: null };

  const kinds = [
    {
      name: "body fat",
      key: "bodyFat",
      recordType: "BodyFat",
      permission: bodyFatReadPermission,
      record: nativeBodyFatRecord,
      otherRecord: nativeLeanMassRecord,
      value: 23.456,
      expectedSample: (sampleId: string, measuredAt: string, value: number) => ({
        sampleId,
        measuredAt,
        value,
      }),
    },
    {
      name: "lean mass",
      key: "leanMass",
      recordType: "LeanBodyMass",
      permission: leanMassReadPermission,
      record: nativeLeanMassRecord,
      otherRecord: nativeBodyFatRecord,
      value: 54.321,
      expectedSample: (sampleId: string, measuredAt: string, value: number) => ({
        sampleId,
        measuredAt,
        value,
        unit: "kilograms",
      }),
    },
  ] as const;

  /** Answers each record type from its own queue of pages, so one kind never feeds the other. */
  function answerWith(pages: {
    BodyFat?: Awaited<ReturnType<typeof readRecords>>[];
    LeanBodyMass?: Awaited<ReturnType<typeof readRecords>>[];
  }) {
    const queues = {
      BodyFat: [...(pages.BodyFat ?? [])],
      LeanBodyMass: [...(pages.LeanBodyMass ?? [])],
    };
    mockedReadRecords.mockImplementation((recordType) => {
      const queue =
        recordType === "BodyFat"
          ? queues.BodyFat
          : recordType === "LeanBodyMass"
            ? queues.LeanBodyMass
            : [];
      return Promise.resolve(queue.shift() ?? { records: [] });
    });
  }

  function callsFor(recordType: string) {
    return mockedReadRecords.mock.calls.filter(([type]) => type === recordType);
  }

  function startTimesFor(recordType: string) {
    return callsFor(recordType).map(([, options]) =>
      options.timeRangeFilter.operator === "after" ? options.timeRangeFilter.startTime : undefined,
    );
  }

  beforeEach(() => {
    mockedGetGrantedPermissions.mockResolvedValue(bothGranted);
  });

  it("should ask each type for a window starting 365 days before now when it has no anchor", async () => {
    await createProvider().readBodyCompositionSince(noStart);

    expect(startTimesFor("BodyFat")).toEqual([isoDaysBeforeNow(365)]);
    expect(startTimesFor("LeanBodyMass")).toEqual([isoDaysBeforeNow(365)]);
  });

  it("should read the clock once, so both kinds start from the same instant", async () => {
    const ticks = [now, new Date(now.getTime() + dayInMilliseconds)];
    let reads = 0;
    const provider = createHealthConnectProvider({
      now: () => ticks[Math.min(reads++, ticks.length - 1)] ?? now,
    });

    await provider.readBodyCompositionSince(noStart);

    expect(startTimesFor("BodyFat")).toEqual([isoDaysBeforeNow(365)]);
    expect(startTimesFor("LeanBodyMass")).toEqual([isoDaysBeforeNow(365)]);
    expect(reads).toBe(1);
  });

  it("should ask each type for exactly its own anchor, and the two can differ", async () => {
    await createProvider().readBodyCompositionSince({
      bodyFat: "2026-10-10T06:15:30.250Z",
      leanMass: "2026-10-12T08:00:00.500Z",
    });

    expect(startTimesFor("BodyFat")).toEqual(["2026-10-10T06:15:30.250Z"]);
    expect(startTimesFor("LeanBodyMass")).toEqual(["2026-10-12T08:00:00.500Z"]);
  });

  it("should read oldest first, one page at a time, with the same options as weight", async () => {
    await createProvider().readBodyCompositionSince(noStart);

    for (const recordType of ["BodyFat", "LeanBodyMass"]) {
      expect(mockedReadRecords).toHaveBeenCalledWith(recordType, {
        timeRangeFilter: { operator: "after", startTime: isoDaysBeforeNow(365) },
        ascendingOrder: true,
        pageSize: 1000,
      });
    }
  });

  it("should not call the library for a kind that is not granted", async () => {
    mockedGetGrantedPermissions.mockResolvedValue([leanMassReadPermission]);

    const read = await createProvider().readBodyCompositionSince(noStart);

    expect(read.bodyFat).toEqual({ status: "no-permission" });
    expect(read.leanMass.status).toBe("read");
    expect(callsFor("BodyFat")).toHaveLength(0);
  });

  it("should not call the library at all when neither kind is granted", async () => {
    mockedGetGrantedPermissions.mockResolvedValue([weightReadPermission]);

    await expect(createProvider().readBodyCompositionSince(noStart)).resolves.toEqual({
      bodyFat: { status: "no-permission" },
      leanMass: { status: "no-permission" },
    });
    expect(mockedReadRecords).not.toHaveBeenCalled();
    expect(mockedRequestPermission).not.toHaveBeenCalled();
  });

  it("should report failed for both kinds when the granted list cannot be read", async () => {
    mockedGetGrantedPermissions.mockRejectedValue(new Error("sample-1 measured 23.456"));

    await expect(createProvider().readBodyCompositionSince(noStart)).resolves.toEqual({
      bodyFat: { status: "failed" },
      leanMass: { status: "failed" },
    });
  });

  it("should report failed for both kinds when initialising fails", async () => {
    mockedInitialize.mockRejectedValue(new Error("not ready"));

    await expect(createProvider().readBodyCompositionSince(noStart)).resolves.toEqual({
      bodyFat: { status: "failed" },
      leanMass: { status: "failed" },
    });
  });

  it("should leave body fat read when the lean mass read throws", async () => {
    mockedReadRecords.mockImplementation((recordType) =>
      recordType === "LeanBodyMass"
        ? Promise.reject(new Error("down"))
        : Promise.resolve({ records: [nativeBodyFatRecord("a", "2026-10-01T07:00:00Z", 23.456)] }),
    );

    const read = await createProvider().readBodyCompositionSince(noStart);

    expect(read.bodyFat).toMatchObject({ status: "read" });
    expect(read.leanMass).toEqual({ status: "failed" });
  });

  it("should leave lean mass read when the body fat read throws", async () => {
    mockedReadRecords.mockImplementation((recordType) =>
      recordType === "BodyFat"
        ? Promise.reject(new Error("down"))
        : Promise.resolve({
            records: [nativeLeanMassRecord("a", "2026-10-01T07:00:00Z", 54.321)],
          }),
    );

    const read = await createProvider().readBodyCompositionSince(noStart);

    expect(read.bodyFat).toEqual({ status: "failed" });
    expect(read.leanMass).toMatchObject({ status: "read" });
  });

  it("should report no-permission for a kind whose read is refused for want of access", async () => {
    mockedReadRecords.mockImplementation((recordType) =>
      recordType === "BodyFat"
        ? Promise.reject(Object.assign(new Error("revoked"), { code: "PERMISSION_ERROR" }))
        : Promise.resolve({ records: [] }),
    );

    const read = await createProvider().readBodyCompositionSince(noStart);

    expect(read.bodyFat).toEqual({ status: "no-permission" });
    expect(read.leanMass.status).toBe("read");
  });

  it("should never throw, whatever the library does", async () => {
    mockedGetGrantedPermissions.mockImplementation(() => {
      throw new Error("thrown at once");
    });

    await expect(createProvider().readBodyCompositionSince(noStart)).resolves.toEqual({
      bodyFat: { status: "failed" },
      leanMass: { status: "failed" },
    });
  });

  it("should report failed instead of looping when a page repeats the token it was asked with", async () => {
    mockedReadRecords.mockResolvedValue({
      records: [nativeBodyFatRecord("a", "2026-10-01T07:00:00Z", 23.456)],
      pageToken: "stuck",
    });

    const read = await createProvider().readBodyCompositionSince({
      bodyFat: "2026-10-01T00:00:00Z",
      leanMass: null,
    });

    expect(read.bodyFat).toEqual({ status: "failed" });
    expect(callsFor("BodyFat")).toHaveLength(2);
  });

  describe.each(kinds)("$name", (kind) => {
    const first = () => kind.record("a", "2026-10-01T07:00:00Z", kind.value);

    it("should follow page tokens and join three pages in order", async () => {
      answerWith({
        [kind.recordType]: [
          { records: [kind.record("a", "2026-10-01T07:00:00Z", 20)], pageToken: "token-1" },
          { records: [kind.record("b", "2026-10-02T07:00:00Z", 21)], pageToken: "token-2" },
          { records: [kind.record("c", "2026-10-03T07:00:00Z", 22)] },
        ],
      });

      const read = await createProvider().readBodyCompositionSince(noStart);

      const result = read[kind.key];
      expect(result.status === "read" && result.samples.map((sample) => sample.sampleId)).toEqual([
        "a",
        "b",
        "c",
      ]);
      expect(callsFor(kind.recordType).map(([, options]) => options.pageToken)).toEqual([
        undefined,
        "token-1",
        "token-2",
      ]);
    });

    it("should keep only the allowed fields of each record", async () => {
      answerWith({
        [kind.recordType]: [
          { records: [kind.record("sample-1", "2026-10-01T07:00:00.123Z", kind.value)] },
        ],
      });

      const read = await createProvider().readBodyCompositionSince(noStart);

      const result = read[kind.key];
      expect(result).toEqual({
        status: "read",
        samples: [kind.expectedSample("sample-1", "2026-10-01T07:00:00.123Z", kind.value)],
        newestSampleAt: "2026-10-01T07:00:00.123Z",
        skippedRecords: 0,
      });
    });

    it("should skip and count a record with no id, no time or no usable value", async () => {
      answerWith({
        [kind.recordType]: [
          {
            records: [
              first(),
              kind.record(undefined, "2026-10-02T07:00:00Z", kind.value),
              kind.record("y", "", kind.value),
              kind.record("z", "2026-10-03T07:00:00Z", Number.NaN),
            ],
          },
        ],
      });

      const result = (await createProvider().readBodyCompositionSince(noStart))[kind.key];

      expect(result.status === "read" && result.samples.map((sample) => sample.sampleId)).toEqual([
        "a",
      ]);
      expect(result.status === "read" && result.skippedRecords).toBe(3);
    });

    it("should report the latest time returned as the newest sample time", async () => {
      answerWith({
        [kind.recordType]: [
          { records: [kind.record("a", "2026-10-01T07:00:00Z", 20)], pageToken: "token-1" },
          {
            records: [
              kind.record("b", "2026-10-02T07:00:00Z", 21),
              kind.record("c", "2026-10-03T07:00:00.500Z", 22),
            ],
          },
        ],
      });

      const result = (await createProvider().readBodyCompositionSince(noStart))[kind.key];

      expect(result.status === "read" && result.newestSampleAt).toBe("2026-10-03T07:00:00.500Z");
    });

    it("should report no newest sample time and no skips for an empty read", async () => {
      const result = (await createProvider().readBodyCompositionSince(noStart))[kind.key];

      expect(result).toEqual({
        status: "read",
        samples: [],
        newestSampleAt: null,
        skippedRecords: 0,
      });
    });

    describe("the 30 day history limit", () => {
      function refuseWindowsOlderThanLimit() {
        mockedReadRecords.mockImplementation((recordType, options) => {
          const startTime =
            options.timeRangeFilter.operator === "after" ? options.timeRangeFilter.startTime : "";
          const refused =
            recordType === kind.recordType &&
            Date.parse(startTime) < now.getTime() - 30 * dayInMilliseconds;
          return refused
            ? Promise.reject(Object.assign(new Error("refused"), { code: "PERMISSION_ERROR" }))
            : Promise.resolve({
                records:
                  recordType === kind.recordType
                    ? [kind.record("recent", "2026-10-10T07:00:00Z", kind.value)]
                    : [],
              });
        });
      }

      it("should retry once from 30 days before now when the first read is refused", async () => {
        refuseWindowsOlderThanLimit();

        const result = (await createProvider().readBodyCompositionSince(noStart))[kind.key];

        expect(result.status === "read" && result.samples.map((sample) => sample.sampleId)).toEqual(
          ["recent"],
        );
        expect(startTimesFor(kind.recordType)).toEqual([
          isoDaysBeforeNow(365),
          isoDaysBeforeNow(30),
        ]);
      });

      it("should not retry when a later page is refused, and report failed", async () => {
        mockedReadRecords.mockImplementation((recordType, options) =>
          recordType === kind.recordType && options.pageToken === "token-1"
            ? Promise.reject(new Error("down"))
            : Promise.resolve(
                recordType === kind.recordType
                  ? {
                      records: [kind.record("old", "2026-01-10T07:00:00Z", kind.value)],
                      pageToken: "token-1",
                    }
                  : { records: [] },
              ),
        );

        const result = (await createProvider().readBodyCompositionSince(noStart))[kind.key];

        expect(result).toEqual({ status: "failed" });
        expect(startTimesFor(kind.recordType)).toEqual([
          isoDaysBeforeNow(365),
          isoDaysBeforeNow(365),
        ]);
      });

      it("should never alter an anchor, even one older than the limit", async () => {
        refuseWindowsOlderThanLimit();
        const anchor = isoDaysBeforeNow(60);

        const read = await createProvider().readBodyCompositionSince({
          bodyFat: anchor,
          leanMass: anchor,
        });

        expect(read[kind.key].status).toBe("no-permission");
        expect(startTimesFor(kind.recordType)).toEqual([anchor]);
      });
    });
  });

  describe("health data handling", () => {
    const consoleMethods = ["log", "warn", "error", "info"] as const;
    const spyOnConsole = () =>
      consoleMethods.map((method) =>
        jest.spyOn(console, method).mockImplementation(() => undefined),
      );

    it("should write nothing to the console while reading", async () => {
      const spies = spyOnConsole();
      answerWith({
        BodyFat: [{ records: [nativeBodyFatRecord("sample-1", "2026-10-01T07:00:00Z", 23.456)] }],
        LeanBodyMass: [
          { records: [nativeLeanMassRecord("sample-2", "2026-10-01T07:00:00Z", 54.321)] },
        ],
      });

      await createProvider().readBodyCompositionSince(noStart);

      spies.forEach((spy) => {
        expect(spy).not.toHaveBeenCalled();
      });
    });

    it("should write nothing to the console when a read fails, and return a status that holds no data", async () => {
      const spies = spyOnConsole();
      mockedReadRecords.mockRejectedValue(new Error("sample-1 measured 23.456 and 54.321"));

      const read = await createProvider().readBodyCompositionSince(noStart);

      spies.forEach((spy) => {
        expect(spy).not.toHaveBeenCalled();
      });
      expect(read).toEqual({ bodyFat: { status: "failed" }, leanMass: { status: "failed" } });
      expect(JSON.stringify(read)).not.toMatch(/23\.456|54\.321|sample-1/);
    });
  });
});

describe("openInstallPage", () => {
  it("should open the market link", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);

    await createProvider().openInstallPage();

    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith("market://details?id=com.google.android.apps.healthdata");
  });

  it("should fall back to the web link when the market link cannot open", async () => {
    const openURL = jest
      .spyOn(Linking, "openURL")
      .mockRejectedValueOnce(new Error("no handler"))
      .mockResolvedValueOnce(true);

    await createProvider().openInstallPage();

    expect(openURL).toHaveBeenLastCalledWith(
      "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata",
    );
  });

  it("should throw a failed error when neither link opens", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no handler"));

    await expect(createProvider().openInstallPage()).rejects.toEqual(
      new HealthProviderError("openInstallPage", "failed"),
    );
  });
});

describe("openSettings", () => {
  it("should open the Health Connect settings", async () => {
    await createProvider().openSettings();

    expect(mockedOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("should throw a failed error when the settings cannot open", async () => {
    mockedOpenSettings.mockImplementation(() => {
      throw new Error("no activity");
    });

    await expect(createProvider().openSettings()).rejects.toEqual(
      new HealthProviderError("openSettings", "failed"),
    );
  });
});

describe("getHealthProvider", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return null on iOS", () => {
    jest.replaceProperty(Platform, "OS", "ios");

    expect(getHealthProvider()).toBeNull();
  });

  it("should return a provider on Android", () => {
    jest.replaceProperty(Platform, "OS", "android");

    expect(getHealthProvider()).not.toBeNull();
  });
});
