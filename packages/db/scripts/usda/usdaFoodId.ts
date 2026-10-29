import { uuidV5 } from "../uuidV5";

/**
 * The namespace of every USDA food id and import run id. It is fixed for good: changing it would give
 * every USDA food a new id, and the foods already in production, their portions and the diary entries
 * that log them would be orphaned.
 */
export const USDA_ID_NAMESPACE = "3b55216d-1c4f-4c9b-b753-eafc427cc51b";

/**
 * The id of a USDA food, a version 5 UUID over `usda:<fdc_id>`. The migration can name the food in its
 * portion rows directly, and the same food always has the same id in every database.
 */
export const usdaFoodId = (fdcId: string): string => uuidV5(USDA_ID_NAMESPACE, `usda:${fdcId}`);
