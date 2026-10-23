import type { ScanOutcome } from "../types";

export type ScanResultProps = {
  outcome: ScanOutcome;
  /** The code as the camera read it, shown in the card at the top of every result. */
  code: string;
  onScanAgain: () => void;
  /**
   * Called with the canonical barcode of a scan nobody has a food for. Leave it out where a food cannot be
   * created from the result, and the result offers to scan again and nothing else.
   */
  onCreateFood?: ((code: string) => void) | undefined;
};
