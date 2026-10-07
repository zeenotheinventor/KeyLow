import {
  SCANNABLE_BARCODE_TYPES,
  toBarcodeSymbology,
} from "../../components/BarcodeScanner/symbology";

describe("barcode symbology", () => {
  it.each([
    ["ean13", "ean13"],
    ["ean8", "ean8"],
    ["upc_a", "upc_a"],
    ["upc_e", "upc_e"],
  ] as const)("should map the camera type %s to the symbology %s", (cameraType, symbology) => {
    expect(toBarcodeSymbology(cameraType)).toBe(symbology);
  });

  it.each(["qr", "code128", "itf14", "", "constructor"])(
    "should give no symbology for the camera type %j",
    (cameraType) => {
      expect(toBarcodeSymbology(cameraType)).toBeUndefined();
    },
  );

  it("should scan exactly the types it can map", () => {
    expect(SCANNABLE_BARCODE_TYPES).toEqual(["ean13", "ean8", "upc_a", "upc_e"]);
  });
});
