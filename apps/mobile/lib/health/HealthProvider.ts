import type {
  HealthBodyFatSample,
  HealthLeanMassSample,
  HealthWeightSample,
} from "@keylow/core/weight";

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

/** Which of the two body composition kinds the user has allowed this app to read. */
export type BodyCompositionAccess = Readonly<{
  bodyFat: boolean;
  leanMass: boolean;
}>;

/** Where each kind's import last got to, as an ISO instant, or null for a kind never read. */
export type HealthBodyCompositionStart = Readonly<{
  bodyFat: string | null;
  leanMass: string | null;
}>;

/**
 * One kind's read. `no-permission` means the kind is not granted (or was refused when read), and the
 * library was not asked for it when the granted list already said so. `failed` holds nothing from the
 * platform, because its message can carry a record id or a value.
 */
export type HealthBodyCompositionKindRead<Sample> =
  | Readonly<{
      status: "read";
      samples: Sample[];
      /** The latest sample time in `samples`, or null when there is none. */
      newestSampleAt: string | null;
      /** Records that had no usable id, time or value, and so were left out. */
      skippedRecords: number;
    }>
  | Readonly<{ status: "no-permission" }>
  | Readonly<{ status: "failed" }>;

export type HealthBodyCompositionRead = Readonly<{
  bodyFat: HealthBodyCompositionKindRead<HealthBodyFatSample>;
  leanMass: HealthBodyCompositionKindRead<HealthLeanMassSample>;
}>;

export type HealthPermissionOptions = Readonly<{
  /** Ask for body fat and lean mass beside weight, in one system sheet. Off unless set. */
  includeBodyComposition?: boolean;
}>;

/**
 * Where weight and body composition come from on this device. The import runner owns the overlap
 * and the anchor, so a provider only reads. A HealthKit implementation can be added later without
 * changing a caller.
 */
export type HealthProvider = {
  availability(): Promise<HealthAvailability>;
  /** True only when `availability()` is `available`. */
  isAvailable(): Promise<boolean>;
  /** Reads the granted list. It never prompts. */
  hasPermission(): Promise<boolean>;
  /**
   * Asks for read access to weight, and with `includeBodyComposition` to body fat and lean mass in
   * the same sheet. The answer is for weight alone, so the caller reads `bodyCompositionAccess()`
   * for the rest.
   */
  requestPermission(options?: HealthPermissionOptions): Promise<HealthPermissionResult>;
  /** Reads the granted list for the two body composition kinds. It never prompts and never throws. */
  bodyCompositionAccess(): Promise<BodyCompositionAccess>;
  /** Asks for body fat and lean mass only, and resolves to what is granted afterwards. */
  requestBodyCompositionPermission(): Promise<BodyCompositionAccess>;
  /**
   * Every weight sample at or after `since` (an ISO instant), oldest first. With a null `since` it
   * reads as far back as the platform allows, up to 365 days.
   */
  readWeightSince(since: string | null): Promise<HealthWeightRead>;
  /**
   * Every body fat and lean mass sample at or after that kind's start, oldest first. A kind with a
   * null start reads as far back as the platform allows, up to 365 days. The two kinds are read
   * independently, so a refused or failing one never touches the other. It never throws.
   */
  readBodyCompositionSince(since: HealthBodyCompositionStart): Promise<HealthBodyCompositionRead>;
  openInstallPage(): Promise<void>;
  /** Opens the platform's health settings, where the user can change app permissions. */
  openSettings(): Promise<void>;
};
