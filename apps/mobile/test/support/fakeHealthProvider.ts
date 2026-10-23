import {
  HealthProviderError,
  type BodyCompositionAccess,
  type HealthAvailability,
  type HealthBodyCompositionKindRead,
  type HealthBodyCompositionRead,
  type HealthBodyCompositionStart,
  type HealthErrorCode,
  type HealthPermissionOptions,
  type HealthPermissionResult,
  type HealthProvider,
  type HealthProviderAction,
  type HealthWeightRead,
} from "../../lib/health";

import type {
  HealthBodyFatSample,
  HealthLeanMassSample,
  HealthWeightSample,
} from "@keylow/core/weight";

type BodyCompositionKind = keyof BodyCompositionAccess;

type HealthProviderCall =
  | {
      method:
        | "availability"
        | "isAvailable"
        | "hasPermission"
        | "bodyCompositionAccess"
        | "requestBodyCompositionPermission"
        | "openInstallPage"
        | "openSettings";
    }
  | { method: "requestPermission"; includeBodyComposition?: boolean }
  | { method: "readWeightSince"; since: string | null }
  | { method: "readBodyCompositionSince"; since: HealthBodyCompositionStart };

/** What the fake answers with. A test changes it after creating the fake to script a later call. */
type FakeHealthProviderState = {
  availability: HealthAvailability;
  permissionGranted: boolean;
  /** What `requestPermission` does: grants when true, leaves permission off when false. */
  grantOnRequest: boolean;
  samples: HealthWeightSample[];
  /** The count a read reports as skipped, for a test of a caller that surfaces it. */
  skippedRecords: number;
  /** The body composition kinds granted now. */
  bodyCompositionAccess: BodyCompositionAccess;
  /** The kinds a request grants. A request only ever turns kinds on, as the system sheet does. */
  grantBodyCompositionOnRequest: BodyCompositionAccess;
  bodyFatSamples: HealthBodyFatSample[];
  leanMassSamples: HealthLeanMassSample[];
  /** The count a body composition read reports as skipped, per kind. */
  bodyCompositionSkippedRecords: Record<BodyCompositionKind, number>;
  /**
   * A kind listed here answers with that status instead of its samples, whatever is granted. Delete
   * the key to stop it. Reads never throw, so this is how a test scripts a refused or failing kind.
   */
  bodyCompositionReadStatus: Partial<Record<BodyCompositionKind, "failed" | "no-permission">>;
  /**
   * An action listed here throws a `HealthProviderError` with the code. Delete the key to stop it.
   * `bodyCompositionAccess` and `readBodyCompositionSince` never throw, so a key for them is ignored.
   */
  failures: Partial<Record<HealthProviderAction, HealthErrorCode>>;
};

export type FakeHealthProvider = HealthProvider & {
  state: FakeHealthProviderState;
  /** Every call, in order, including the ones that threw. */
  calls: HealthProviderCall[];
};

/**
 * A `HealthProvider` that answers from `state` and records its calls. A read filters and orders
 * `samples` the way the Health Connect one does: at or after `since`, oldest first.
 */
export function createFakeHealthProvider(
  initial: Partial<FakeHealthProviderState> = {},
): FakeHealthProvider {
  const state: FakeHealthProviderState = {
    availability: "available",
    permissionGranted: false,
    grantOnRequest: true,
    samples: [],
    skippedRecords: 0,
    bodyCompositionAccess: { bodyFat: false, leanMass: false },
    grantBodyCompositionOnRequest: { bodyFat: true, leanMass: true },
    bodyFatSamples: [],
    leanMassSamples: [],
    bodyCompositionSkippedRecords: { bodyFat: 0, leanMass: 0 },
    bodyCompositionReadStatus: {},
    failures: {},
    ...initial,
  };
  const calls: HealthProviderCall[] = [];

  function failIfScripted(action: HealthProviderAction): void {
    const code = state.failures[action];
    if (code !== undefined) {
      throw new HealthProviderError(action, code);
    }
  }

  /** Runs the answer inside a promise, so a scripted failure rejects the way a native call does. */
  function respond<Answer>(produce: () => Answer): Promise<Answer> {
    return new Promise((resolve) => {
      resolve(produce());
    });
  }

  function availability(): Promise<HealthAvailability> {
    return respond(() => {
      calls.push({ method: "availability" });
      return state.availability;
    });
  }

  function isAvailable(): Promise<boolean> {
    return respond(() => {
      calls.push({ method: "isAvailable" });
      return state.availability === "available";
    });
  }

  function hasPermission(): Promise<boolean> {
    return respond(() => {
      calls.push({ method: "hasPermission" });
      failIfScripted("hasPermission");
      return state.permissionGranted;
    });
  }

  function grantRequestedBodyComposition(): void {
    state.bodyCompositionAccess = {
      bodyFat: state.bodyCompositionAccess.bodyFat || state.grantBodyCompositionOnRequest.bodyFat,
      leanMass:
        state.bodyCompositionAccess.leanMass || state.grantBodyCompositionOnRequest.leanMass,
    };
  }

  function requestPermission(options?: HealthPermissionOptions): Promise<HealthPermissionResult> {
    return respond(() => {
      calls.push({
        method: "requestPermission",
        ...(options?.includeBodyComposition === undefined
          ? {}
          : { includeBodyComposition: options.includeBodyComposition }),
      });
      failIfScripted("requestPermission");
      state.permissionGranted = state.grantOnRequest;
      if (options?.includeBodyComposition === true) {
        grantRequestedBodyComposition();
      }
      return state.grantOnRequest ? "granted" : "denied";
    });
  }

  function bodyCompositionAccess(): Promise<BodyCompositionAccess> {
    return respond(() => {
      calls.push({ method: "bodyCompositionAccess" });
      return { ...state.bodyCompositionAccess };
    });
  }

  function requestBodyCompositionPermission(): Promise<BodyCompositionAccess> {
    return respond(() => {
      calls.push({ method: "requestBodyCompositionPermission" });
      failIfScripted("requestBodyCompositionPermission");
      grantRequestedBodyComposition();
      return { ...state.bodyCompositionAccess };
    });
  }

  function readWeightSince(since: string | null): Promise<HealthWeightRead> {
    return respond(() => {
      calls.push({ method: "readWeightSince", since });
      failIfScripted("readWeightSince");
      const earliest = since === null ? -Infinity : Date.parse(since);
      const samples = state.samples
        .filter((sample) => Date.parse(sample.measuredAt) >= earliest)
        .sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt));
      return {
        samples,
        newestSampleAt: samples.at(-1)?.measuredAt ?? null,
        skippedRecords: state.skippedRecords,
      };
    });
  }

  /** Filters and orders one kind the way `readWeightSince` does: at or after `since`, oldest first. */
  function readKind<Sample extends { measuredAt: string }>(
    kind: BodyCompositionKind,
    stored: Sample[],
    since: string | null,
  ): HealthBodyCompositionKindRead<Sample> {
    const scripted = state.bodyCompositionReadStatus[kind];
    if (scripted !== undefined) {
      return { status: scripted };
    }
    if (!state.bodyCompositionAccess[kind]) {
      return { status: "no-permission" };
    }
    const earliest = since === null ? -Infinity : Date.parse(since);
    const samples = stored
      .filter((sample) => Date.parse(sample.measuredAt) >= earliest)
      .sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt));
    return {
      status: "read",
      samples,
      newestSampleAt: samples.at(-1)?.measuredAt ?? null,
      skippedRecords: state.bodyCompositionSkippedRecords[kind],
    };
  }

  function readBodyCompositionSince(
    since: HealthBodyCompositionStart,
  ): Promise<HealthBodyCompositionRead> {
    return respond(() => {
      calls.push({ method: "readBodyCompositionSince", since });
      return {
        bodyFat: readKind("bodyFat", state.bodyFatSamples, since.bodyFat),
        leanMass: readKind("leanMass", state.leanMassSamples, since.leanMass),
      };
    });
  }

  function openInstallPage(): Promise<void> {
    return respond(() => {
      calls.push({ method: "openInstallPage" });
      failIfScripted("openInstallPage");
    });
  }

  function openSettings(): Promise<void> {
    return respond(() => {
      calls.push({ method: "openSettings" });
      failIfScripted("openSettings");
    });
  }

  return {
    state,
    calls,
    availability,
    isAvailable,
    hasPermission,
    requestPermission,
    bodyCompositionAccess,
    requestBodyCompositionPermission,
    readWeightSince,
    readBodyCompositionSince,
    openInstallPage,
    openSettings,
  };
}
