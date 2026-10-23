/** The provider calls that can fail. `availability` never throws, it reports `unsupported` instead. */
export type HealthProviderAction =
  | "hasPermission"
  | "requestPermission"
  | "readWeightSince"
  | "openInstallPage"
  | "openSettings"
  | "bodyCompositionAccess"
  | "requestBodyCompositionPermission"
  | "readBodyCompositionSince";

/**
 * `permission` means the platform refused the call for want of access (for example a permission
 * revoked since it was granted). `failed` is everything else.
 */
export type HealthErrorCode = "permission" | "failed";

/**
 * Health data never reaches an error, so this carries the action and a fixed code and nothing from
 * the platform's own error, whose message can hold a record id or a time.
 */
export class HealthProviderError extends Error {
  readonly action: HealthProviderAction;
  readonly code: HealthErrorCode;

  constructor(action: HealthProviderAction, code: HealthErrorCode) {
    super(`${action}: ${code}`);
    this.name = "HealthProviderError";
    this.action = action;
    this.code = code;
  }
}
