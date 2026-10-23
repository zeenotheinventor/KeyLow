import { Linking } from "react-native";
import {
  SdkAvailabilityStatus,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
} from "react-native-health-connect";

import { HealthProviderError } from "./HealthProviderError";

import type {
  BodyCompositionAccess,
  HealthAvailability,
  HealthBodyCompositionKindRead,
  HealthBodyCompositionRead,
  HealthBodyCompositionStart,
  HealthPermissionOptions,
  HealthPermissionResult,
  HealthProvider,
  HealthWeightRead,
} from "./HealthProvider";
import type { HealthErrorCode, HealthProviderAction } from "./HealthProviderError";
import type {
  HealthBodyFatSample,
  HealthLeanMassSample,
  HealthWeightSample,
} from "@keylow/core/weight";
import type { ReadRecordsResult, RecordResult } from "react-native-health-connect";

// Health Connect needs no Play Console declaration for a sideloaded build. That matters only for a
// Play listing, so nothing here waits on it.

const HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata";
const MARKET_URL = `market://details?id=${HEALTH_CONNECT_PACKAGE}`;
const WEB_URL = `https://play.google.com/store/apps/details?id=${HEALTH_CONNECT_PACKAGE}`;

const WEIGHT_READ_PERMISSION = { accessType: "read", recordType: "Weight" } as const;
const BODY_FAT_READ_PERMISSION = { accessType: "read", recordType: "BodyFat" } as const;
const LEAN_MASS_READ_PERMISSION = { accessType: "read", recordType: "LeanBodyMass" } as const;

const FIRST_READ_DAYS = 365;
/**
 * Without the history permission Health Connect lets an app read only the 30 days before its first
 * grant, and Android's documentation says a read from further back "results in an error".
 */
const HISTORY_LIMIT_DAYS = 30;
const PAGE_SIZE = 1000;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

type HealthConnectProviderOptions = {
  /** The clock, passed in so the adapter never reads it itself. */
  now: () => Date;
};

function isoDaysBefore(now: Date, days: number): string {
  return new Date(now.getTime() - days * DAY_IN_MILLISECONDS).toISOString();
}

function errorCodeOf(error: unknown): HealthErrorCode {
  const isPermissionError =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "PERMISSION_ERROR";
  return isPermissionError ? "permission" : "failed";
}

/** Replaces whatever the library threw, whose message can hold a record id or a time. */
function failure(action: HealthProviderAction, error: unknown): HealthProviderError {
  return new HealthProviderError(action, errorCodeOf(error));
}

type GrantedPermissions = readonly { accessType: string; recordType: string }[];

function hasReadAccess(
  granted: GrantedPermissions,
  wanted: { accessType: string; recordType: string },
): boolean {
  return granted.some(
    (permission) =>
      permission.accessType === wanted.accessType && permission.recordType === wanted.recordType,
  );
}

function bodyCompositionAccessOf(granted: GrantedPermissions): BodyCompositionAccess {
  return {
    bodyFat: hasReadAccess(granted, BODY_FAT_READ_PERMISSION),
    leanMass: hasReadAccess(granted, LEAN_MASS_READ_PERMISSION),
  };
}

type ReadableRecordType = "Weight" | "BodyFat" | "LeanBodyMass";

type SampleRead<Sample> = {
  samples: Sample[];
  newestSampleAt: string | null;
  skippedRecords: number;
};

/** Turns one record into a sample, or null when it lacks a usable id, time or value. */
type SampleOf<Type extends ReadableRecordType, Sample> = (
  record: RecordResult<Type>,
) => Sample | null;

function isUsableNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** The id and time every record kind carries. Nothing else of the metadata is read. */
function identityOf(record: {
  time: string;
  metadata?: { id?: string };
}): { sampleId: string; measuredAt: string } | null {
  const sampleId = record.metadata?.id;
  return sampleId && record.time ? { sampleId, measuredAt: record.time } : null;
}

// The library types a record's mass as `value` and `unit`, but its read path returns `inKilograms`
// and the other units, so the kilograms are taken from there.
const weightSampleOf: SampleOf<"Weight", HealthWeightSample> = (record) => {
  const identity = identityOf(record);
  const kilograms = record.weight.inKilograms;
  return identity && isUsableNumber(kilograms)
    ? { ...identity, value: kilograms, unit: "kilograms" }
    : null;
};

const bodyFatSampleOf: SampleOf<"BodyFat", HealthBodyFatSample> = (record) => {
  const identity = identityOf(record);
  return identity && isUsableNumber(record.percentage)
    ? { ...identity, value: record.percentage }
    : null;
};

const leanMassSampleOf: SampleOf<"LeanBodyMass", HealthLeanMassSample> = (record) => {
  const identity = identityOf(record);
  const kilograms = record.mass.inKilograms;
  return identity && isUsableNumber(kilograms)
    ? { ...identity, value: kilograms, unit: "kilograms" }
    : null;
};

function readPage<Type extends ReadableRecordType>(
  recordType: Type,
  startTime: string,
  pageToken: string | undefined,
): Promise<ReadRecordsResult<Type>> {
  return readRecords(recordType, {
    timeRangeFilter: { operator: "after", startTime },
    ascendingOrder: true,
    pageSize: PAGE_SIZE,
    ...(pageToken === undefined ? {} : { pageToken }),
  });
}

/** Collects the samples of `firstPage` and of every page after it. Only what `sampleOf` keeps leaves. */
async function collectPages<Type extends ReadableRecordType, Sample extends { measuredAt: string }>(
  recordType: Type,
  startTime: string,
  firstPage: ReadRecordsResult<Type>,
  sampleOf: SampleOf<Type, Sample>,
): Promise<SampleRead<Sample>> {
  const samples: Sample[] = [];
  let skippedRecords = 0;
  let page = firstPage;
  let requestedToken: string | undefined;

  for (;;) {
    for (const record of page.records) {
      const sample = sampleOf(record);
      if (sample === null) {
        skippedRecords += 1;
      } else {
        samples.push(sample);
      }
    }
    // The native module sends null, not undefined, on the last page.
    const nextToken = page.pageToken || undefined;
    if (nextToken === undefined) {
      break;
    }
    // A page that hands back the token it was asked with would loop for ever.
    if (nextToken === requestedToken) {
      throw new Error("The page token did not advance");
    }
    requestedToken = nextToken;
    page = await readPage(recordType, startTime, nextToken);
  }

  return { samples, newestSampleAt: samples.at(-1)?.measuredAt ?? null, skippedRecords };
}

/**
 * Reads one record type from `since`, or from as far back as the platform allows when it is null.
 * Anything thrown is the library's own, so a caller replaces it before it goes any further.
 */
async function readSince<Type extends ReadableRecordType, Sample extends { measuredAt: string }>(
  recordType: Type,
  since: string | null,
  now: Date,
  sampleOf: SampleOf<Type, Sample>,
): Promise<SampleRead<Sample>> {
  if (since !== null) {
    return collectPages(recordType, since, await readPage(recordType, since, undefined), sampleOf);
  }
  const yearStart = isoDaysBefore(now, FIRST_READ_DAYS);
  let startTime = yearStart;
  let firstPage;
  try {
    firstPage = await readPage(recordType, yearStart, undefined);
  } catch {
    // The history limit can only refuse a window on its first page, so only that page is retried,
    // once, from the limit. A refusal after a page was read is a real failure, and carrying on from
    // a later window would move the caller's anchor past history it never received.
    startTime = isoDaysBefore(now, HISTORY_LIMIT_DAYS);
    firstPage = await readPage(recordType, startTime, undefined);
  }
  return collectPages(recordType, startTime, firstPage, sampleOf);
}

function availabilityOf(status: number): HealthAvailability {
  switch (status) {
    case SdkAvailabilityStatus.SDK_AVAILABLE:
      return "available";
    // Android 13 and below report a missing Health Connect app as this status, as well as one that
    // is out of date.
    case SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED:
      return "needs-install";
    default:
      return "unsupported";
  }
}

export function createHealthConnectProvider({ now }: HealthConnectProviderOptions): HealthProvider {
  let initialising: Promise<void> | null = null;

  /** The library must be initialised before its first use. A failed attempt is not remembered. */
  function ensureInitialised(): Promise<void> {
    initialising ??= initialize().then(
      () => undefined,
      (error: unknown) => {
        initialising = null;
        throw error;
      },
    );
    return initialising;
  }

  async function availability(): Promise<HealthAvailability> {
    try {
      return availabilityOf(await getSdkStatus());
    } catch {
      return "unsupported";
    }
  }

  async function hasPermission(): Promise<boolean> {
    try {
      await ensureInitialised();
      return hasReadAccess(await getGrantedPermissions(), WEIGHT_READ_PERMISSION);
    } catch (error) {
      throw failure("hasPermission", error);
    }
  }

  async function bodyCompositionAccess(): Promise<BodyCompositionAccess> {
    try {
      await ensureInitialised();
      return bodyCompositionAccessOf(await getGrantedPermissions());
    } catch {
      return { bodyFat: false, leanMass: false };
    }
  }

  async function askForPermission(
    options: HealthPermissionOptions = {},
  ): Promise<HealthPermissionResult> {
    try {
      await ensureInitialised();
      const granted = await requestPermission(
        options.includeBodyComposition === true
          ? [WEIGHT_READ_PERMISSION, BODY_FAT_READ_PERMISSION, LEAN_MASS_READ_PERMISSION]
          : [WEIGHT_READ_PERMISSION],
      );
      return hasReadAccess(granted, WEIGHT_READ_PERMISSION) ? "granted" : "denied";
    } catch (error) {
      throw failure("requestPermission", error);
    }
  }

  async function askForBodyCompositionPermission(): Promise<BodyCompositionAccess> {
    try {
      await ensureInitialised();
      return bodyCompositionAccessOf(
        await requestPermission([BODY_FAT_READ_PERMISSION, LEAN_MASS_READ_PERMISSION]),
      );
    } catch (error) {
      throw failure("requestBodyCompositionPermission", error);
    }
  }

  async function readWeightSince(since: string | null): Promise<HealthWeightRead> {
    try {
      await ensureInitialised();
      return await readSince("Weight", since, now(), weightSampleOf);
    } catch (error) {
      throw failure("readWeightSince", error);
    }
  }

  /** One kind of a body composition read. A refusal or failure here is that kind's status alone. */
  async function readKind<Type extends ReadableRecordType, Sample extends { measuredAt: string }>(
    recordType: Type,
    isGranted: boolean,
    since: string | null,
    current: Date,
    sampleOf: SampleOf<Type, Sample>,
  ): Promise<HealthBodyCompositionKindRead<Sample>> {
    if (!isGranted) {
      return { status: "no-permission" };
    }
    try {
      return { status: "read", ...(await readSince(recordType, since, current, sampleOf)) };
    } catch (error) {
      return errorCodeOf(error) === "permission"
        ? { status: "no-permission" }
        : { status: "failed" };
    }
  }

  async function readBodyCompositionSince(
    since: HealthBodyCompositionStart,
  ): Promise<HealthBodyCompositionRead> {
    let access: BodyCompositionAccess;
    let current: Date;
    try {
      await ensureInitialised();
      access = bodyCompositionAccessOf(await getGrantedPermissions());
      current = now();
    } catch {
      return { bodyFat: { status: "failed" }, leanMass: { status: "failed" } };
    }
    const bodyFat = await readKind(
      "BodyFat",
      access.bodyFat,
      since.bodyFat,
      current,
      bodyFatSampleOf,
    );
    const leanMass = await readKind(
      "LeanBodyMass",
      access.leanMass,
      since.leanMass,
      current,
      leanMassSampleOf,
    );
    return { bodyFat, leanMass };
  }

  async function openInstallPage(): Promise<void> {
    try {
      await Linking.openURL(MARKET_URL);
    } catch {
      try {
        await Linking.openURL(WEB_URL);
      } catch (error) {
        throw failure("openInstallPage", error);
      }
    }
  }

  function openSettings(): Promise<void> {
    return Promise.resolve().then(() => {
      try {
        openHealthConnectSettings();
      } catch (error) {
        throw failure("openSettings", error);
      }
    });
  }

  return {
    availability,
    isAvailable: async () => (await availability()) === "available",
    hasPermission,
    requestPermission: askForPermission,
    bodyCompositionAccess,
    requestBodyCompositionPermission: askForBodyCompositionPermission,
    readWeightSince,
    readBodyCompositionSince,
    openInstallPage,
    openSettings,
  };
}
