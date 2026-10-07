import type { BarcodeSymbology } from "@keylow/core/foods";
import type { BarcodeType } from "expo-camera";

// The camera reports each of these under the same name core uses, but the map is written out so
// that a renamed type on either side fails here and not silently at 8 digits, where the
// symbology decides between EAN-8 and UPC-E.
const symbologyByCameraType = new Map<string, BarcodeSymbology>([
  ["ean13", "ean13"],
  ["ean8", "ean8"],
  ["upc_a", "upc_a"],
  ["upc_e", "upc_e"],
]);

/** The barcode types the camera is asked to look for: the ones a food product carries. */
export const SCANNABLE_BARCODE_TYPES: BarcodeType[] = ["ean13", "ean8", "upc_a", "upc_e"];

/** The symbology of a camera barcode type, or undefined for a type core does not know. */
export function toBarcodeSymbology(cameraType: string): BarcodeSymbology | undefined {
  return symbologyByCameraType.get(cameraType);
}
