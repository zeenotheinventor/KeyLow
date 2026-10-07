import { useCallback, useEffect, useRef, useState } from "react";

import { toBarcodeSymbology } from "./symbology";

import type { ScannedBarcode } from "./types";

// The camera reports a barcode in view many times a second, so a scan is accepted at most this often.
const MINIMUM_MILLISECONDS_BETWEEN_SCANS = 1500;

/**
 * Accepts one scan at a time. While an accepted scan is resolving or showing its result, every
 * other scan is ignored, the same code and a different one alike. `clearScan` ends it, and even
 * then a scan is only accepted 1.5 s after the last accepted one. A scan delivered while the
 * screen is not in focus is ignored, so a queued camera event cannot start a lookup under another
 * screen. The guards are refs, so two scans delivered before React re-renders cannot both get in.
 */
export function useBarcodeScan(isFocused: boolean) {
  const [scan, setScan] = useState<ScannedBarcode | undefined>(undefined);
  const isScanActiveRef = useRef(false);
  const lastAcceptedAtRef = useRef<number | undefined>(undefined);
  const isFocusedRef = useRef(isFocused);

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  const handleBarcodeScanned = useCallback(({ type, data }: { type: string; data: string }) => {
    if (!isFocusedRef.current || isScanActiveRef.current) {
      return;
    }

    const now = Date.now();
    if (
      lastAcceptedAtRef.current !== undefined &&
      now - lastAcceptedAtRef.current < MINIMUM_MILLISECONDS_BETWEEN_SCANS
    ) {
      return;
    }

    lastAcceptedAtRef.current = now;
    isScanActiveRef.current = true;
    setScan({ rawCode: data, symbology: toBarcodeSymbology(type) });
  }, []);

  const clearScan = useCallback(() => {
    isScanActiveRef.current = false;
    setScan(undefined);
  }, []);

  return { scan, handleBarcodeScanned, clearScan };
}
