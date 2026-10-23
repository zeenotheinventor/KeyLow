import type { HealthConnection } from "../useHealthConnection";

export type WeightImportStatusProps = {
  connection: HealthConnection;
  /** Whether an import is running, from any trigger. */
  isImporting: boolean;
  /** When an import last ended well, an ISO instant, or null when none has. */
  lastImportedAt: string | null;
  /** The current time, from the screen's clock, so the minutes move on by themselves. */
  now: Date;
  /** Opens the permission flow. */
  onConnect: () => void;
};
