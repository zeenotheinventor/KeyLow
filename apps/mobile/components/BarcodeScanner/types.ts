import type { BarcodeInvalidReason, BarcodeSymbology } from "@keylow/core/foods";

/** A scan that was accepted: the code as the camera read it and the symbology it reported. */
export type ScannedBarcode = {
  rawCode: string;
  symbology: BarcodeSymbology | undefined;
};

/** What the scan screen has to say about the scan it accepted. */
export type ScanOutcome =
  | { status: "looking_up" }
  | { status: "opening_food" }
  | { status: "not_found"; code: string }
  | { status: "invalid"; reason: BarcodeInvalidReason }
  | { status: "rate_limited"; retryAfterSeconds?: number }
  | { status: "failed" };

export type BarcodeScannerProps = {
  /**
   * Whether the camera, or the permission prompt, is on screen. The scanner renders nothing while
   * it is false but stays mounted, so the permission it has read is not read again.
   */
  isActive: boolean;
  /** Called with each barcode the camera reads. It reads the same one many times a second. */
  onBarcodeScanned: (scan: { type: string; data: string }) => void;
  onCancel: () => void;
};
