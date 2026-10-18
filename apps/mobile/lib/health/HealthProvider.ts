import type { HealthWeightSample } from "@keylow/core/weight";

/**
 * `needs-install` is Health Connect missing or out of date on Android 13 and below, where it is a
 * separate Play app. `unsupported` is a device with no Health Connect at all.
 */
export type HealthAvailability = "available" | "needs-install" | "unsupported";

export type HealthPermissionResult = "granted" | "denied";

export type HealthWeightRead = Readonly<{
  samples: HealthWeightSample[];
  /** The latest sample time in `samples`, or null when there is none. */
  newestSampleAt: string | null;
  /** Records the platform returned that had no usable id, time or weight, and so were left out. */
  skippedRecords: number;
}>;

/**
 * Where weight comes from on this device. The import runner owns the overlap and the anchor, so a
 * provider only reads. A HealthKit implementation can be added later without changing a caller.
 */
export type HealthProvider = {
  availability(): Promise<HealthAvailability>;
  /** True only when `availability()` is `available`. */
  isAvailable(): Promise<boolean>;
  /** Reads the granted list. It never prompts. */
  hasPermission(): Promise<boolean>;
  /** Asks for read access to weight only. */
  requestPermission(): Promise<HealthPermissionResult>;
  /**
   * Every weight sample at or after `since` (an ISO instant), oldest first. With a null `since` it
   * reads as far back as the platform allows, up to 365 days.
   */
  readWeightSince(since: string | null): Promise<HealthWeightRead>;
  openInstallPage(): Promise<void>;
  /** Opens the platform's health settings, where the user can change app permissions. */
  openSettings(): Promise<void>;
};
