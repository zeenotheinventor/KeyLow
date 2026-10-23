import type {
  BodyCompositionAccess,
  HealthAvailability,
  HealthImportStatus,
  HealthPermissionResult,
  HealthProvider,
} from "../../lib/health";

/** One state of the board `health-access: permissions flow`. */
export type HealthAccessStep =
  | "explain"
  | "install"
  | "connecting"
  | "denied"
  | "import-error"
  | "connected"
  | "explain-body-composition"
  | "denied-body-composition"
  | "connected-partial";

/**
 * Which flow the screen runs. `first` asks for weight, with body fat and lean mass beside it. `add-body-composition`
 * is for a person whose weight is already connected, and asks for the two body types only.
 */
export type HealthAccessMode = "first" | "add-body-composition";

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
  /** The body types Ki-Lo may read now: what the provider's granted list says, or what the last request answered. */
  bodyCompositionAccess: BodyCompositionAccess;
  /** The flow asked for. `add-body-composition` is run only while weight permission is held. */
  mode: HealthAccessMode;
  /** Whether `requestBodyCompositionPermission()` has been answered in the add-later flow. */
  hasAskedBodyComposition: boolean;
  /** Whether an import is running, the runner's own or the one the flow asked for. */
  isImporting: boolean;
  /** The status `importNow()` resolved with, or null while it has not. */
  importStatus: HealthImportStatus | null;
}>;

export type HealthAccessScreenProps = {
  provider: HealthProvider;
  /** The flow to run. It is `first` unless the route asks to add body fat and lean mass. */
  mode?: HealthAccessMode;
  /** Returns to the Weight screen: Close, Not now and See your trend. */
  onClose: () => void;
};
