import type { ScanOutcome } from "../types";

export type ScanResultProps = {
  outcome: ScanOutcome;
  onScanAgain: () => void;
  /** Called with the canonical barcode of a scan nobody has a food for. */
  onCreateFood: (code: string) => void;
};
