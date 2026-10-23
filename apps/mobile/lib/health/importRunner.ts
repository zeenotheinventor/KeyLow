import {
  HEALTH_IMPORT_OVERLAP_DAYS,
  mapHealthBodyFatSamples,
  mapHealthLeanMassSamples,
  mapHealthSamples,
} from "@keylow/core/weight";

import { HealthProviderError } from "./HealthProviderError";

import type { HealthAnchorStore } from "./healthAnchorStore";
import type { HealthBodyCompositionKindRead, HealthProvider } from "./HealthProvider";
import type {
  BodyMeasurementInsert,
  BodyMeasurementKind,
  HealthWeighInInsert,
} from "@keylow/core/weight";

/**
 * `imported` and `nothing-new` are an import that ended well. `unavailable` is no Health Connect on
 * this device, `no-permission` is weight access not granted (or taken away), and `failed` is anything
 * else, including a time zone that is not known yet.
 */
export type HealthImportStatus =
  "imported" | "nothing-new" | "unavailable" | "no-permission" | "failed";

/**
 * How one body composition kind went. `no-permission` is access to the kind not held (or taken away),
 * `failed` is a read or a save that did not work, and `not-run` is a pass that returned before the body
 * step (Health Connect unavailable, weight access missing, or no time zone).
 */
export type BodyKindStatus = "imported" | "nothing-new" | "no-permission" | "failed" | "not-run";

/** The same counts as the weight result, for one kind. A fixed status and counts, and nothing from the data. */
export type BodyKindResult = Readonly<{
  status: BodyKindStatus;
  read: number;
  skipped: number;
  inserted: number;
}>;

/**
 * Counts and a fixed status, and nothing from the data. `read` is the samples the provider gave,
 * `skipped` is the records and samples that could not be used, and `inserted` is the rows the save
 * stored (a row stored before, a deleted one included, is not counted). The four weight fields never
 * depend on `body`, which is how each body composition kind went in the same pass.
 */
export type HealthImportResult = Readonly<{
  status: HealthImportStatus;
  read: number;
  skipped: number;
  inserted: number;
  body: Readonly<{ bodyFat: BodyKindResult; leanMass: BodyKindResult }>;
}>;

type WeightImportResult = Omit<HealthImportResult, "body">;
type BodyImportResult = HealthImportResult["body"];

export type HealthImportDependencies = Readonly<{
  userId: string;
  /** Null where there is no Health provider, which is every platform but Android. */
  provider: HealthProvider | null;
  anchorStore: HealthAnchorStore;
  /** The profile's IANA zone, or null while it has not loaded. */
  timeZone: string | null;
  /** The api-client bulk import. It chunks the rows and ignores ones already stored. */
  importWeighIns: (rows: readonly HealthWeighInInsert[]) => Promise<{ inserted: number }>;
  /** The api-client bulk import for body fat and lean mass. It is called once for each kind. */
  importBodyMeasurements: (rows: readonly BodyMeasurementInsert[]) => Promise<{ inserted: number }>;
  now: () => Date;
}>;

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const noCounts = { read: 0, skipped: 0, inserted: 0 } as const;

const notRunKind: BodyKindResult = { status: "not-run", ...noCounts };

/** The body result of a pass that returned before the body step. */
export const bodyNotRun: BodyImportResult = { bodyFat: notRunKind, leanMass: notRunKind };

function withoutCounts(status: HealthImportStatus): WeightImportResult {
  return { status, ...noCounts };
}

function bodyWithoutCounts(status: BodyKindStatus): BodyKindResult {
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

/** Where to read from: the stored anchor less the overlap, or null for a kind never read. */
function sinceOf(storedAnchorTime: number | null): string | null {
  return storedAnchorTime === null
    ? null
    : new Date(storedAnchorTime - HEALTH_IMPORT_OVERLAP_DAYS * DAY_IN_MILLISECONDS).toISOString();
}

/**
 * The weight step. It decides its own result and never rejects, so what follows it (the body step)
 * cannot change it.
 */
async function importWeight(
  dependencies: HealthImportDependencies,
  provider: HealthProvider,
  timeZone: string,
): Promise<WeightImportResult> {
  const { userId, anchorStore, importWeighIns, now } = dependencies;

  try {
    const storedAnchorTime = anchorTime(await anchorStore.getAnchor(userId));
    const { samples, newestSampleAt, skippedRecords } = await provider.readWeightSince(
      sinceOf(storedAnchorTime),
    );
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

type BodyKindInputs<Sample> = Readonly<{
  measurementKind: BodyMeasurementKind;
  /** Where the kind's anchor was when the pass started. */
  storedAnchorTime: number | null;
  read: HealthBodyCompositionKindRead<Sample>;
  map: (
    samples: readonly Sample[],
    options: { timeZone: string },
  ) => { rows: BodyMeasurementInsert[]; skipped: number };
}>;

/**
 * One kind's save and anchor. It never rejects, and the kind's anchor moves only after its own save
 * has resolved, so a save that fails leaves the anchor and the other kind as they were.
 */
async function importBodyKind<Sample>(
  dependencies: HealthImportDependencies,
  timeZone: string,
  { measurementKind, storedAnchorTime, read, map }: BodyKindInputs<Sample>,
): Promise<BodyKindResult> {
  const { userId, anchorStore, importBodyMeasurements, now } = dependencies;

  if (read.status !== "read") {
    return bodyWithoutCounts(read.status);
  }

  try {
    const { rows, skipped: skippedSamples } = map(read.samples, { timeZone });
    const skipped = read.skippedRecords + skippedSamples;

    if (read.samples.length === 0) {
      return { status: "nothing-new", read: 0, skipped, inserted: 0 };
    }

    const { inserted } = rows.length === 0 ? { inserted: 0 } : await importBodyMeasurements(rows);

    const anchor = nextAnchor(read.newestSampleAt, storedAnchorTime, now());
    if (anchor !== null) {
      await anchorStore.setBodyAnchor(userId, measurementKind, anchor);
    }

    return { status: "imported", read: read.samples.length, skipped, inserted };
  } catch {
    // Dropped on purpose, as in the weight step.
    return bodyWithoutCounts("failed");
  }
}

/**
 * The body step: one read for both kinds, each with its own anchor, then one save per kind. It never
 * rejects and touches nothing the weight step decided. A kind that is not allowed comes back from the
 * provider as `no-permission`, and the runner never asks.
 */
async function importBodyComposition(
  dependencies: HealthImportDependencies,
  provider: HealthProvider,
  timeZone: string,
): Promise<BodyImportResult> {
  const { userId, anchorStore } = dependencies;

  try {
    const bodyFatAnchorTime = anchorTime(await anchorStore.getBodyAnchor(userId, "body_fat_pct"));
    const leanMassAnchorTime = anchorTime(await anchorStore.getBodyAnchor(userId, "lean_mass_kg"));
    const read = await provider.readBodyCompositionSince({
      bodyFat: sinceOf(bodyFatAnchorTime),
      leanMass: sinceOf(leanMassAnchorTime),
    });

    const bodyFat = await importBodyKind(dependencies, timeZone, {
      measurementKind: "body_fat_pct",
      storedAnchorTime: bodyFatAnchorTime,
      read: read.bodyFat,
      map: mapHealthBodyFatSamples,
    });
    const leanMass = await importBodyKind(dependencies, timeZone, {
      measurementKind: "lean_mass_kg",
      storedAnchorTime: leanMassAnchorTime,
      read: read.leanMass,
      map: mapHealthLeanMassSamples,
    });
    return { bodyFat, leanMass };
  } catch {
    // Dropped on purpose, as in the weight step.
    const failed = bodyWithoutCounts("failed");
    return { bodyFat: failed, leanMass: failed };
  }
}

async function importOnce(dependencies: HealthImportDependencies): Promise<HealthImportResult> {
  const { provider, timeZone } = dependencies;

  try {
    if (provider === null || (await provider.availability()) !== "available") {
      return { ...withoutCounts("unavailable"), body: bodyNotRun };
    }
    // The runner never prompts. Asking for permission belongs to the screen that explains it. Weight
    // access is the gate for the whole pass, so a person who allowed body composition and not weight
    // is not connected, and the body step does not run.
    if (!(await provider.hasPermission())) {
      return { ...withoutCounts("no-permission"), body: bodyNotRun };
    }
    if (timeZone === null) {
      return { ...withoutCounts("failed"), body: bodyNotRun };
    }

    // Weight first, finished and decided before the body step starts, and the body step runs
    // whatever the weight step ended as.
    const weight = await importWeight(dependencies, provider, timeZone);
    const body = await importBodyComposition(dependencies, provider, timeZone);
    return { ...weight, body };
  } catch (error) {
    // Only the pre-checks can throw to here. The error is dropped on purpose: a library's message can
    // quote a record.
    return { ...withoutCounts(statusOfFailure(error)), body: bodyNotRun };
  }
}

const runningByUser = new Map<string, Promise<HealthImportResult>>();

/**
 * Reads the weight Health Connect holds since the anchor (less the overlap) and saves it, then moves
 * the anchor, and in the same pass does the same for body fat and lean mass, each with an anchor of
 * its own. It never rejects and never prompts. While an import runs for a user, a second request for
 * that user gets the running one's promise, whichever step it is in, so a foreground event during a
 * pull to refresh does not read twice.
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
