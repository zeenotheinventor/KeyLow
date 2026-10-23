import type {
  HealthAvailability,
  HealthImportStatus,
  HealthPermissionResult,
  HealthProvider,
} from "../../lib/health";

/** One state of the board `health-access: permissions flow`. */
export type HealthAccessStep =
  "explain" | "install" | "connecting" | "denied" | "import-error" | "connected";

/**
 * What the flow has learned so far, and nothing else. Where there is no Health Connect at all the flow does
 * not open, so the availability here is one of the two a state is drawn for.
 */
export type HealthAccessInputs = Readonly<{
  availability: Exclude<HealthAvailability, "unsupported">;
  /** Whether permission was already held when the flow checked. */
  hasPermission: boolean;
  /** The answer to `requestPermission()`, or null while nothing has been asked. */
  permissionAnswer: HealthPermissionResult | null;
  /** Whether an import is running, the runner's own or the one the flow asked for. */
  isImporting: boolean;
  /** The status `importNow()` resolved with, or null while it has not. */
  importStatus: HealthImportStatus | null;
}>;

export type HealthAccessScreenProps = {
  provider: HealthProvider;
  /** Returns to the Weight screen: Close, Not now and See your trend. */
  onClose: () => void;
};
