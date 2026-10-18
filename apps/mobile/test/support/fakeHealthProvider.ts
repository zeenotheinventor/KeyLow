import {
  HealthProviderError,
  type HealthAvailability,
  type HealthErrorCode,
  type HealthPermissionResult,
  type HealthProvider,
  type HealthProviderAction,
  type HealthWeightRead,
} from "../../lib/health";

import type { HealthWeightSample } from "@keylow/core/weight";

type HealthProviderCall =
  | {
      method:
        | "availability"
        | "isAvailable"
        | "hasPermission"
        | "requestPermission"
        | "openInstallPage"
        | "openSettings";
    }
  | { method: "readWeightSince"; since: string | null };

/** What the fake answers with. A test changes it after creating the fake to script a later call. */
type FakeHealthProviderState = {
  availability: HealthAvailability;
  permissionGranted: boolean;
  /** What `requestPermission` does: grants when true, leaves permission off when false. */
  grantOnRequest: boolean;
  samples: HealthWeightSample[];
  /** The count a read reports as skipped, for a test of a caller that surfaces it. */
  skippedRecords: number;
  /** An action listed here throws a `HealthProviderError` with the code. Delete the key to stop it. */
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

  function requestPermission(): Promise<HealthPermissionResult> {
    return respond(() => {
      calls.push({ method: "requestPermission" });
      failIfScripted("requestPermission");
      state.permissionGranted = state.grantOnRequest;
      return state.grantOnRequest ? "granted" : "denied";
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
    readWeightSince,
    openInstallPage,
    openSettings,
  };
}
