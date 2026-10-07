// What a test needs to register a product on the Open Food Facts mock and to generate its barcode.
// Both come from @keylow/db's function suites, which is where the mock lives.
export {
  drainGeneratedBarcodes,
  generateBarcode,
} from "../../../../db/test/integration/support/barcodes";
export { offMock } from "../../../../db/test/integration/support/offMock";
