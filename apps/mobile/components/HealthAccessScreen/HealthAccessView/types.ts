import type { HealthAccessStep } from "../types";

export type HealthAccessViewProps = {
  step: HealthAccessStep;
  /** The rows the import stored, for the heading of the connected state. */
  importedCount: number;
  /** The Close button in the header. */
  onClose: () => void;
  /** The footer's main button: Continue, Get Health Connect, Open Health Connect, Try again or See your trend. */
  onPrimary: () => void;
  /** The footer's quiet button: Not now or Close. */
  onSecondary: () => void;
  onOpenPrivacyPolicy: () => void;
};
