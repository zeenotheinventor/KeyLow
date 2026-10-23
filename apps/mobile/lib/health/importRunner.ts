import { HEALTH_IMPORT_OVERLAP_DAYS, mapHealthSamples } from "@keylow/core/weight";

import { HealthProviderError } from "./HealthProviderError";

import type { HealthAnchorStore } from "./healthAnchorStore";
import type { HealthProvider } from "./HealthProvider";
import type { HealthWeighInInsert } from "@keylow/core/weight";

/**
 * `imported` and `nothing-new` are an import that ended well. `unavailable` is no Health Connect on
 * this device, `no-permission` is weight access not granted (or taken away), and `failed` is anything
 * else, including a time zone that is not known yet.
 */
export type HealthImportStatus =
  "imported" | "nothing-new" | "unavailable" | "no-permission" | "failed";

/**
 * Counts and a fixed status, and nothing from the data. `read` is the samples the provider gave,
 * `skipped` is the records and samples that could not be used, and `inserted` is the rows the save
 * stored (a row stored before, a deleted one included, is not counted).
 */
export type HealthImportResult = Readonly<{
  status: HealthImportStatus;
  read: number;
  skipped: number;
  inserted: number;
}>;

export type HealthImportDependencies = Readonly<{
  userId: string;
  /** Null where there is no Health provider, which is every platform but Android. */
  provider: HealthProvider | null;
  anchorStore: HealthAnchorStore;
  /** The profile's IANA zone, or null while it has not loaded. */
  timeZone: string | null;
  /** The api-client bulk import. It chunks the rows and ignores ones already stored. */
  importWeighIns: (rows: readonly HealthWeighInInsert[]) => Promise<{ inserted: number }>;
  now: () => Date;
}>;

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const noCounts = { read: 0, skipped: 0, inserted: 0 } as const;

function withoutCounts(status: HealthImportStatus): HealthImportResult {
  return { status, ...noCounts };
}

/** The stored anchor as a time, or null when there is none or it does not read as a time. */
function anchorTime(anchor: string | null): number | null {
  const time = anchor === null ? Number.NaN : Date.parse(anchor);
  return Number.isNaN(time) ? null : time;
}

/**
 * The anchor to store: the newest sample time, never later than now and never earlier than the anchor
 * already stored. Null when it would not move.
 */
function nextAnchor(
  newestSampleAt: string | null,
  storedAnchorTime: number | null,
  now: Date,
): string | null {
  const newestTime = newestSampleAt === null ? Number.NaN : Date.parse(newestSampleAt);
  if (Number.isNaN(newestTime)) {
    return null;
  }
  const candidate = Math.min(newestTime, now.getTime());
  return storedAnchorTime !== null && candidate <= storedAnchorTime
    ? null
    : new Date(candidate).toISOString();
}

/** A refusal for want of access is the no-permission state. Anything else is a failed import. */
function statusOfFailure(error: unknown): HealthImportStatus {
  return error instanceof HealthProviderError && error.code === "permission"
    ? "no-permission"
    : "failed";
}

async function importOnce(dependencies: HealthImportDependencies): Promise<HealthImportResult> {
  const { userId, provider, anchorStore, timeZone, importWeighIns, now } = dependencies;

  try {
    if (provider === null || (await provider.availability()) !== "available") {
      return withoutCounts("unavailable");
    }
    // The runner never prompts. Asking for permission belongs to the screen that explains it.
    if (!(await provider.hasPermission())) {
      return withoutCounts("no-permission");
    }
    if (timeZone === null) {
      return withoutCounts("failed");
    }

    const storedAnchorTime = anchorTime(await anchorStore.getAnchor(userId));
    const since =
      storedAnchorTime === null
        ? null
        : new Date(
            storedAnchorTime - HEALTH_IMPORT_OVERLAP_DAYS * DAY_IN_MILLISECONDS,
          ).toISOString();

    const { samples, newestSampleAt, skippedRecords } = await provider.readWeightSince(since);
    const { rows, skipped: skippedSamples } = mapHealthSamples(samples, { timeZone });
    const skipped = skippedRecords + skippedSamples;

    if (samples.length === 0) {
      await anchorStore.setLastImport(userId, now().toISOString());
      return { status: "nothing-new", read: 0, skipped, inserted: 0 };
    }

    const { inserted } = rows.length === 0 ? { inserted: 0 } : await importWeighIns(rows);

    // Only now that the save has resolved. A save that rejected threw past this point.
    const anchor = nextAnchor(newestSampleAt, storedAnchorTime, now());
    if (anchor !== null) {
      await anchorStore.setAnchor(userId, anchor);
    }
    await anchorStore.setLastImport(userId, now().toISOString());

    return { status: "imported", read: samples.length, skipped, inserted };
  } catch (error) {
    // The error is dropped on purpose: a library's message can quote a record.
    return withoutCounts(statusOfFailure(error));
  }
}

const runningByUser = new Map<string, Promise<HealthImportResult>>();

/**
 * Reads the weight Health Connect holds since the anchor (less the overlap) and saves it, then moves
 * the anchor. It never rejects and never prompts. While an import runs for a user, a second request
 * for that user gets the running one's promise, so a foreground event during a pull to refresh does
 * not read twice.
 */
export function runHealthImport(
  dependencies: HealthImportDependencies,
): Promise<HealthImportResult> {
  const running = runningByUser.get(dependencies.userId);
  if (running !== undefined) {
    return running;
  }

  const started = importOnce(dependencies).finally(() => {
    runningByUser.delete(dependencies.userId);
  });
  runningByUser.set(dependencies.userId, started);
  return started;
}
