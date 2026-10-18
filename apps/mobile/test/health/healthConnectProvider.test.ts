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
