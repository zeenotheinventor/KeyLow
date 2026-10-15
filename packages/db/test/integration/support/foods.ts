import { drainGeneratedBarcodes } from "./barcodes";
import { adminClient } from "./stack";

/**
 * Deletes the shared OFF rows for every barcode this file generated, then proves none are left.
 * food_portions and food_source_data both reference foods with `on delete cascade` (migration
 * foods.sql), and the service role has delete on all three tables, so deleting the foods is enough.
 * The count matters because a filter that matches nothing deletes nothing and returns no error.
 */
export async function deleteGeneratedFoods(): Promise<void> {
  const codes = drainGeneratedBarcodes();
  const admin = adminClient();

  const { error } = await admin.from("foods").delete().eq("source", "off").in("source_ref", codes);
  if (error) {
    throw new Error("Could not delete the generated foods", { cause: error });
  }

  const { count, error: countError } = await admin
    .from("foods")
    .select("id", { count: "exact", head: true })
    .eq("source", "off")
    .in("source_ref", codes);
  if (countError) {
    throw new Error("Could not count the generated foods left behind", { cause: countError });
  }
  if (count !== 0) {
    throw new Error(`Expected no generated foods left after the delete, found ${count}`);
  }
}
