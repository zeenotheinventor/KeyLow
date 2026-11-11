import {
  BOWL_DEPTH_RANGE_CM,
  BOWL_DIAMETER_RANGE_CM,
  BOWL_SIZES_CM,
  DEFAULT_FILL,
  FILL_SHARES,
  PLATE_DIAMETERS_CM,
  PLATE_DIAMETER_RANGE_CM,
  PORTION_ESTIMATE_BOWLS,
  bowlVolume,
  isPlateContainer,
  plateWellArea,
} from "./containers";
import { FOOD_TYPE_FIGURES } from "./foodTypes";
import { buildLogEntry } from "../../diary/buildLogEntry";

import type { PortionEstimateContainer, PortionEstimateFill } from "./containers";
import type { PortionEstimateFoodType } from "./foodTypes";
import type { Food } from "../../schemas/food";

export type PortionEstimateItemInput = {
  food_id: string;
  /** The food as the caller read it, or null when it could not be read. */
  food: Food | null;
  food_type: PortionEstimateFoodType;
  /** Whole percent of the container, 1 to 100. */
  share_percent: number | null;
  /** The energy the person said, which wins over a share. */
  kcal: number | null;
};

export type PortionEstimateInput = {
  /** Null when every item has `kcal`. */
  container: PortionEstimateContainer | null;
  diameter_cm: number | null;
  radius_cm: number | null;
  depth_cm: number | null;
  fill: PortionEstimateFill | null;
  items: readonly PortionEstimateItemInput[];
};

export type PortionEstimateItemError = "not_found" | "counted_food" | "no_kcal" | "bowl_only";

export type PortionEstimateNutrients = {
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
};

export type PortionEstimateItemResult =
  | { status: "error"; food_id: string; code: PortionEstimateItemError }
  | {
      status: "ok";
      food_id: string;
      name: string;
      unit: "g" | "ml";
      amount: number;
      method: "share" | "kcal";
      nutrients: PortionEstimateNutrients;
      /** More than twice what the container holds of this food: worth asking before logging. */
      largerThanContainer: boolean;
    };

export type PortionEstimateResult =
  | { status: "invalid_input"; fields: string[] }
  | { status: "ok"; sharesScaled: boolean; items: PortionEstimateItemResult[] };

const MAX_ITEMS = 8;
const SHARE_STEP = 5;
const LARGER_THAN_CONTAINER_FACTOR = 2;
// Only read by `buildLogEntry`, which needs a moment. The nutrients do not depend on it.
const NO_TIMING = { loggedAt: "1970-01-01T00:00:00+00:00", localDate: "1970-01-01" };

type Geometry = {
  /** Plate: cm2 covered. Bowl: ml. */
  plateWellAreaSquareCm: number | null;
  bowlVolumeMl: number | null;
  fillShare: number;
};

const isWithin = (value: number, range: { min: number; max: number }) =>
  value >= range.min && value <= range.max;

const isValidShare = (share: number) => Number.isInteger(share) && share >= 1 && share <= 100;

type ShareOrKcal = Pick<PortionEstimateItemInput, "kcal" | "share_percent">;

const isUsableItem = ({ kcal, share_percent }: ShareOrKcal) =>
  kcal === null ? share_percent !== null && isValidShare(share_percent) : kcal > 0;

/**
 * The fields to correct, or an empty list. A share with no container names the container. It needs no
 * food, so a caller can refuse a call before it reads any.
 */
export function portionEstimateProblems(
  input: Omit<PortionEstimateInput, "items"> & { items: readonly ShareOrKcal[] },
): string[] {
  const fields: string[] = [];
  const { container } = input;
  if (container === null && input.items.some(({ kcal }) => kcal === null)) {
    fields.push("container");
  }
  if (
    input.items.length < 1 ||
    input.items.length > MAX_ITEMS ||
    !input.items.every(isUsableItem)
  ) {
    fields.push("items");
  }
  if (container === null) {
    return fields;
  }
  const isPlate = isPlateContainer(container);
  const diameterRange = isPlate ? PLATE_DIAMETER_RANGE_CM : BOWL_DIAMETER_RANGE_CM;
  if (input.diameter_cm !== null && !isWithin(input.diameter_cm, diameterRange)) {
    fields.push("diameter_cm");
  }
  if (
    input.radius_cm !== null &&
    !isWithin(input.radius_cm, { min: diameterRange.min / 2, max: diameterRange.max / 2 })
  ) {
    fields.push("radius_cm");
  }
  if (!isPlate && input.depth_cm !== null && !isWithin(input.depth_cm, BOWL_DEPTH_RANGE_CM)) {
    fields.push("depth_cm");
  }
  return fields;
}

function geometryOf(input: PortionEstimateInput): Geometry {
  const fillShare = FILL_SHARES[input.fill ?? DEFAULT_FILL];
  const { container } = input;
  if (container === null) {
    return { plateWellAreaSquareCm: null, bowlVolumeMl: null, fillShare };
  }
  const givenDiameter =
    input.diameter_cm ?? (input.radius_cm === null ? null : input.radius_cm * 2);
  if (isPlateContainer(container)) {
    return {
      plateWellAreaSquareCm: plateWellArea(givenDiameter ?? PLATE_DIAMETERS_CM[container]),
      bowlVolumeMl: null,
      fillShare,
    };
  }
  const size = BOWL_SIZES_CM[container];
  return {
    plateWellAreaSquareCm: null,
    bowlVolumeMl: bowlVolume(givenDiameter ?? size.diameter, input.depth_cm ?? size.depth),
    fillShare,
  };
}

const BOWL_FOOD_TYPES: readonly PortionEstimateFoodType[] = [
  "soup_liquid",
  "yogurt_porridge",
  "cereal_dry",
];

/** With no container named, an amount is measured against the largest default of its kind. */
function fallbackGeometryOf(foodType: PortionEstimateFoodType): Geometry {
  const fillShare = FILL_SHARES[DEFAULT_FILL];
  return BOWL_FOOD_TYPES.includes(foodType)
    ? {
        plateWellAreaSquareCm: null,
        bowlVolumeMl: PORTION_ESTIMATE_BOWLS.large_bowl.volumeMl,
        fillShare,
      }
    : {
        plateWellAreaSquareCm: plateWellArea(PLATE_DIAMETERS_CM.large_plate),
        bowlVolumeMl: null,
        fillShare,
      };
}

const roundedToStep = (value: number) =>
  Math.max(SHARE_STEP, Math.round(value / SHARE_STEP) * SHARE_STEP);

/** What a whole container holds of this food, in the food's own unit, or null when it has no such figure. */
function capacityOf(
  geometry: Geometry,
  foodType: PortionEstimateFoodType,
  unit: "g" | "ml",
): number | null {
  const { plateHeapDepthCm, densityGramsPerMl } = FOOD_TYPE_FIGURES[foodType];
  if (geometry.bowlVolumeMl !== null) {
    return unit === "ml" ? geometry.bowlVolumeMl : geometry.bowlVolumeMl * densityGramsPerMl;
  }
  if (geometry.plateWellAreaSquareCm !== null && plateHeapDepthCm !== null) {
    const volume = geometry.plateWellAreaSquareCm * plateHeapDepthCm;
    return unit === "ml" ? volume : volume * densityGramsPerMl;
  }
  return null;
}

/** The volume a share covers, in ml, or null for a food that cannot be on a plate. */
function shareVolumeOf(
  geometry: Geometry,
  foodType: PortionEstimateFoodType,
  share: number,
): number | null {
  if (geometry.bowlVolumeMl !== null) {
    return geometry.bowlVolumeMl * geometry.fillShare * share;
  }
  const { plateHeapDepthCm } = FOOD_TYPE_FIGURES[foodType];
  if (geometry.plateWellAreaSquareCm === null || plateHeapDepthCm === null) {
    return null;
  }
  return geometry.plateWellAreaSquareCm * plateHeapDepthCm * share;
}

function nutrientsOf(food: Food, amount: number, unit: "g" | "ml"): PortionEstimateNutrients {
  // The same call the diary makes when it writes an entry, so these are the numbers log_entry will save.
  const { nutrients } = buildLogEntry({ food, quantity: amount, unit, ...NO_TIMING });
  return {
    kcal: nutrients.kcal,
    protein_g: nutrients.protein_g,
    fat_g: nutrients.fat_g,
    carbs_g: nutrients.carbs_g,
  };
}

function estimateItem(
  item: PortionEstimateItemInput,
  geometry: Geometry,
  shareScale: number,
): PortionEstimateItemResult {
  const { food, food_id } = item;
  const fail = (code: PortionEstimateItemError): PortionEstimateItemResult => ({
    status: "error",
    food_id,
    code,
  });
  if (food === null) {
    return fail("not_found");
  }
  if (food.basis === "per_portion") {
    return fail("counted_food");
  }
  const unit = food.basis === "per_100ml" ? "ml" : "g";
  const { densityGramsPerMl } = FOOD_TYPE_FIGURES[item.food_type];
  const capacity = capacityOf(
    geometry.plateWellAreaSquareCm === null && geometry.bowlVolumeMl === null
      ? fallbackGeometryOf(item.food_type)
      : geometry,
    item.food_type,
    unit,
  );

  let amount: number;
  let method: "share" | "kcal";
  if (item.kcal !== null) {
    if (food.kcal === null || food.kcal <= 0) {
      return fail("no_kcal");
    }
    amount = Math.max(1, Math.round((item.kcal / food.kcal) * 100));
    method = "kcal";
  } else {
    const share = ((item.share_percent ?? 0) * shareScale) / 100;
    const volume = shareVolumeOf(geometry, item.food_type, share);
    if (volume === null) {
      return fail("bowl_only");
    }
    amount = roundedToStep(unit === "ml" ? volume : volume * densityGramsPerMl);
    method = "share";
  }
  return {
    status: "ok",
    food_id,
    name: food.name,
    unit,
    amount,
    method,
    nutrients: nutrientsOf(food, amount, unit),
    largerThanContainer:
      method === "kcal" && capacity !== null && amount > capacity * LARGER_THAN_CONTAINER_FACTOR,
  };
}

/**
 * Turns the share of a plate or bowl each food covers, or a calorie figure the person knows, into the
 * grams (or ml) to log, with the nutrients for that amount. The model never multiplies: it names the
 * container, the kind of food and the share, and every number it then says comes from here. All the
 * figures are uncited editorial estimates, so the amounts are estimates and are said with "about".
 */
export function estimatePortions(input: PortionEstimateInput): PortionEstimateResult {
  const fields = portionEstimateProblems(input);
  if (fields.length > 0) {
    return { status: "invalid_input", fields };
  }
  const geometry = geometryOf(input);
  const shareTotal = input.items.reduce(
    (total, { kcal, share_percent }) => (kcal === null ? total + (share_percent ?? 0) : total),
    0,
  );
  const sharesScaled = shareTotal > 100;
  const shareScale = sharesScaled ? 100 / shareTotal : 1;
  return {
    status: "ok",
    sharesScaled,
    items: input.items.map((item) => estimateItem(item, geometry, shareScale)),
  };
}
