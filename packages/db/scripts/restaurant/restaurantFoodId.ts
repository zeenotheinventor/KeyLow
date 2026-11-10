import { uuidV5 } from "../uuidV5";

/**
 * The namespace of every restaurant food id and import run id. It is fixed for good: changing it would
 * give every restaurant food a new id, and the foods already in production, their portions and the diary
 * entries that log them would be orphaned.
 */
export const RESTAURANT_ID_NAMESPACE = "0f7a6843-b2f7-4302-ba5d-bdde26898cd7";

/**
 * The id of a restaurant food, a version 5 UUID over `restaurant:<ref>`. The migration can name the food
 * in its portion rows directly, and the same food always has the same id in every database.
 */
export const restaurantFoodId = (ref: string): string =>
  uuidV5(RESTAURANT_ID_NAMESPACE, `restaurant:${ref}`);
