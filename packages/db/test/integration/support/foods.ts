import { drainGeneratedBarcodes } from "./barcodes";
import { adminClient } from "./stack";

/** Deletes the shared OFF rows for every barcode this file generated. Portions and raw data cascade. */
export async function deleteGeneratedFoods(): Promise<void> {
  const codes = drainGeneratedBarcodes();
  const { error } = await adminClient()
    .from("foods")
    .delete()
    .eq("source", "off")
    .in("source_ref", codes);
  if (error) {
    throw new Error("Could not delete the generated foods", { cause: error });
  }
}
