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
  HealthAvailability,
  HealthPermissionResult,
  HealthProvider,
  HealthWeightRead,
} from "./HealthProvider";
import type { HealthErrorCode, HealthProviderAction } from "./HealthProviderError";
import type { HealthWeightSample } from "@keylow/core/weight";

// Health Connect needs no Play Console declaration for a sideloaded build. That matters only for a
// Play listing, so nothing here waits on it.

const HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata";
const MARKET_URL = `market://details?id=${HEALTH_CONNECT_PACKAGE}`;
const WEB_URL = `https://play.google.com/store/apps/details?id=${HEALTH_CONNECT_PACKAGE}`;

const WEIGHT_READ_PERMISSION = { accessType: "read", recordType: "Weight" } as const;

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

function hasWeightReadAccess(
  granted: readonly { accessType: string; recordType: string }[],
): boolean {
  return granted.some(
    (permission) =>
      permission.accessType === WEIGHT_READ_PERMISSION.accessType &&
      permission.recordType === WEIGHT_READ_PERMISSION.recordType,
  );
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

  function readPage(startTime: string, pageToken: string | undefined) {
    return readRecords("Weight", {
      timeRangeFilter: { operator: "after", startTime },
      ascendingOrder: true,
      pageSize: PAGE_SIZE,
      ...(pageToken === undefined ? {} : { pageToken }),
    });
  }

  /**
   * Collects the samples of `firstPage` and of every page after it. The library types a record's
   * weight as `value` and `unit`, but its read path returns `inKilograms` and the other units, so the
   * kilograms are taken from there. Only the four fields of a sample leave this function.
   */
  async function collectPages(
    startTime: string,
    firstPage: Awaited<ReturnType<typeof readPage>>,
  ): Promise<HealthWeightRead> {
    const samples: HealthWeightSample[] = [];
    let skippedRecords = 0;
    let page = firstPage;
    let requestedToken: string | undefined;

    for (;;) {
      for (const record of page.records) {
        const sampleId = record.metadata?.id;
        const kilograms = record.weight.inKilograms;
        if (
          !sampleId ||
          !record.time ||
          typeof kilograms !== "number" ||
          !Number.isFinite(kilograms)
        ) {
          skippedRecords += 1;
          continue;
        }
        samples.push({ sampleId, measuredAt: record.time, value: kilograms, unit: "kilograms" });
      }
      // The native module sends null, not undefined, on the last page.
      const nextToken = page.pageToken || undefined;
      if (nextToken === undefined) {
        break;
      }
      // A page that hands back the token it was asked with would loop for ever.
      if (nextToken === requestedToken) {
        throw new HealthProviderError("readWeightSince", "failed");
      }
      requestedToken = nextToken;
      page = await readPage(startTime, nextToken);
    }

    return { samples, newestSampleAt: samples.at(-1)?.measuredAt ?? null, skippedRecords };
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
      return hasWeightReadAccess(await getGrantedPermissions());
    } catch (error) {
      throw failure("hasPermission", error);
    }
  }

  async function askForPermission(): Promise<HealthPermissionResult> {
    try {
      await ensureInitialised();
      const granted = await requestPermission([WEIGHT_READ_PERMISSION]);
      return hasWeightReadAccess(granted) ? "granted" : "denied";
    } catch (error) {
      throw failure("requestPermission", error);
    }
  }

  async function readWeightSince(since: string | null): Promise<HealthWeightRead> {
    try {
      await ensureInitialised();
      if (since !== null) {
        return await collectPages(since, await readPage(since, undefined));
      }
      const today = now();
      const yearStart = isoDaysBefore(today, FIRST_READ_DAYS);
      let startTime = yearStart;
      let firstPage;
      try {
        firstPage = await readPage(yearStart, undefined);
      } catch {
        // The history limit can only refuse a window on its first page, so only that page is retried,
        // once, from the limit. A refusal after a page was read is a real failure, and carrying on from
        // a later window would move the caller's anchor past history it never received.
        startTime = isoDaysBefore(today, HISTORY_LIMIT_DAYS);
        firstPage = await readPage(startTime, undefined);
      }
      return await collectPages(startTime, firstPage);
    } catch (error) {
      throw failure("readWeightSince", error);
    }
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
    readWeightSince,
    openInstallPage,
    openSettings,
  };
}
