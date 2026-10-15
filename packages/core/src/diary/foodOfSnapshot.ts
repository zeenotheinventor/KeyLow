import type { FoodSnapshot } from "./schemas";
import type { Food } from "../schemas/food";

/**
 * A food row made from what an entry froze, so the screens that draw a food (its hero, its values per
 * 100 g) can draw a logged entry from its own snapshot and never from the live food. Only the name, basis,
 * density and nutrients are the snapshot's; the rest is neutral: no flag asks for a review, and the food is
 * not deleted. `createdAt` is the entry's, since a snapshot has no creation time of its own.
 */
export const foodOfSnapshot = (snapshot: FoodSnapshot, createdAt: string): Food => ({
  id: snapshot.ref,
  source: "user",
  source_ref: null,
  owner_id: null,
  name: snapshot.name,
  brand: null,
  barcode: null,
  basis: snapshot.basis,
  density_g_per_ml: snapshot.density,
  kcal: snapshot.per100.kcal,
  protein_g: snapshot.per100.protein_g,
  fat_g: snapshot.per100.fat_g,
  carbs_g: snapshot.per100.carbs_g,
  fibre_g: snapshot.per100.fibre_g,
  sat_fat_g: snapshot.per100.sat_fat_g ?? null,
  sugars_g: snapshot.per100.sugars_g ?? null,
  salt_g: snapshot.per100.salt_g ?? null,
  micros: {},
  quality: {},
  food_group: null,
  fetched_at: null,
  deleted_at: null,
  created_at: createdAt,
});
