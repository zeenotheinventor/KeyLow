export { authLinkDestination } from "./authLinkDestination";
export type { AuthLinkDestination, AuthLinkResult } from "./authLinkDestination";
export { hasPasswordSignIn } from "./hasPasswordSignIn";
export { passwordResetRequestOutcome } from "./passwordResetRequestOutcome";
export type { PasswordResetRequestOutcome } from "./passwordResetRequestOutcome";
export { describePasswordUpdateFailure } from "./passwordUpdateFailure";
export type { PasswordUpdateFailure, PasswordUpdateOutcome } from "./passwordUpdateFailure";
export {
  RECOVERY_LINK_LIFETIME_MS,
  isRecentRecoveryRequest,
  parseRecoveryRequestedAt,
} from "./recoveryRequest";
export { RESEND_WAIT_SECONDS, resendSecondsLeft } from "./resendCountdown";
export { validateEmailAddress } from "./validateEmailAddress";
export { PASSWORD_MIN_LENGTH, validateNewPassword } from "./validateNewPassword";
export type { NewPasswordProblems } from "./validateNewPassword";
