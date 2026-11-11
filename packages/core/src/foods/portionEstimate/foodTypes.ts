// Uncited editorial estimates, like the containers: a typical heap depth on a plate and a typical bulk
// density, per kind of food. A plate holds covered area x heap depth x density, a bowl holds volume x
// fill x share x density.

export const PORTION_ESTIMATE_FOOD_TYPES = [
  "leafy_salad",
  "vegetables",
  "rice_grains_pasta",
  "potatoes",
  "curry_stew_sauce",
  "meat_fish",
  "bread_bakery",
  "dessert",
  "soup_liquid",
  "cereal_dry",
  "yogurt_porridge",
  "other",
] as const;

export type PortionEstimateFoodType = (typeof PORTION_ESTIMATE_FOOD_TYPES)[number];

type FoodTypeFigures = {
  /** Heap depth on a plate in cm, or null for a food that is only ever served in a bowl. */
  plateHeapDepthCm: number | null;
  /** Bulk density in g per ml. */
  densityGramsPerMl: number;
};

export const FOOD_TYPE_FIGURES: Record<PortionEstimateFoodType, FoodTypeFigures> = {
  leafy_salad: { plateHeapDepthCm: 3, densityGramsPerMl: 0.1 },
  vegetables: { plateHeapDepthCm: 2, densityGramsPerMl: 0.6 },
  rice_grains_pasta: { plateHeapDepthCm: 2.5, densityGramsPerMl: 0.7 },
  potatoes: { plateHeapDepthCm: 3, densityGramsPerMl: 0.65 },
  curry_stew_sauce: { plateHeapDepthCm: 2, densityGramsPerMl: 1 },
  meat_fish: { plateHeapDepthCm: 2, densityGramsPerMl: 0.85 },
  bread_bakery: { plateHeapDepthCm: 4, densityGramsPerMl: 0.3 },
  dessert: { plateHeapDepthCm: 3.5, densityGramsPerMl: 0.6 },
  soup_liquid: { plateHeapDepthCm: null, densityGramsPerMl: 1 },
  cereal_dry: { plateHeapDepthCm: 2, densityGramsPerMl: 0.3 },
  yogurt_porridge: { plateHeapDepthCm: 2, densityGramsPerMl: 1.05 },
  other: { plateHeapDepthCm: 2, densityGramsPerMl: 0.8 },
};
