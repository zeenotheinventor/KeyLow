import { foodSnapshotSchema } from "@keylow/core/diary";
import { quantityUnitSchema } from "@keylow/core/nutrition";
import { shoppingItemSchema, shoppingItemWriteSchema } from "@keylow/core/shopping";
import { z } from "zod";

import { idOfRow, parseRow } from "./diaryRows";

import type { Database } from "../database.types";
import type { ShoppingIngredient, ShoppingItem, ShoppingItemWrite } from "@keylow/core/shopping";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

// A shopping list is health data (ADR 0003, Amendment 15), and the database's own message and details
// can quote a failing row. So a failure here names the action and the error code only, and the cause
// holds the code and nothing else. A row that does not parse is reported by its id and the paths of the
// fields that failed.

const ITEM_COLUMNS =
  "id,food_id,name,grams,portion_label,portion_count,sources,position,checked_at";

// A read of its own, so the recipe reads keep their columns: the recipe's servings and each
// ingredient's amount and frozen food, with the food as it is now for the store cupboard rules.
const SOURCE_COLUMNS =
  "id,name,servings,recipe_ingredients(position,food_id,quantity,unit,resolved_grams,snapshot,foods(name,food_group))";

export const shoppingRepoError = (action: string, cause: PostgrestError) =>
  new Error(`Could not ${action} (${cause.code})`, { cause: { code: cause.code } });

const sourceIngredientSchema = z.object({
  position: z.number().int().nonnegative(),
  food_id: z.guid(),
  quantity: z.number(),
  unit: quantityUnitSchema,
  resolved_grams: z.number(),
  snapshot: foodSnapshotSchema,
  // Null when the food cannot be read, and the frozen name is sorted instead.
  foods: z.object({ name: z.string(), food_group: z.string().nullable() }).nullable(),
});

const sourceRecipeSchema = z
  .object({
    id: z.guid(),
    name: z.string(),
    servings: z.number(),
    recipe_ingredients: z.array(sourceIngredientSchema),
  })
  .transform(({ id, name, servings, recipe_ingredients }): ShoppingSourceRecipe => ({
    id,
    name,
    servings,
    ingredients: [...recipe_ingredients]
      .sort((first, second) => first.position - second.position)
      .map((ingredient): ShoppingIngredient => ({
        foodId: ingredient.food_id,
        name: ingredient.snapshot.name,
        food: ingredient.foods,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        resolvedGrams: ingredient.resolved_grams,
        portionLabel: ingredient.snapshot.portion?.label ?? null,
      })),
  }));

/** A recipe as the shopping list reads it: its saved servings and its ingredients in list order. */
export type ShoppingSourceRecipe = {
  id: string;
  name: string;
  servings: number;
  ingredients: ShoppingIngredient[];
};

/**
 * The signed in user's shopping list, in list order (`position`, then id). Row level security shows a
 * user their own items only, so no owner is passed. Ticked items are listed with the rest, and each
 * says when it was ticked in `checked_at`.
 */
export async function listShoppingItems(client: SupabaseClient<Database>): Promise<ShoppingItem[]> {
  const { data, error } = await client
    .from("shopping_list_items")
    .select(ITEM_COLUMNS)
    .order("position", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw shoppingRepoError("load your shopping list", error);
  }

  return data.map((row) => parseRow(shoppingItemSchema, row, "load your shopping list", idOfRow));
}

/**
 * The recipes to add, with what the list needs of each ingredient, in the order the ids were given. A
 * recipe that is not visible to the user is left out, which is the same for an id that does not exist.
 * An archived recipe is read like a live one.
 */
export async function getShoppingSources(
  client: SupabaseClient<Database>,
  recipeIds: readonly string[],
): Promise<ShoppingSourceRecipe[]> {
  if (recipeIds.length === 0) {
    return [];
  }
  const { data, error } = await client
    .from("recipes")
    .select(SOURCE_COLUMNS)
    .in("id", [...new Set(recipeIds)]);

  if (error) {
    throw shoppingRepoError("load the recipes for your shopping list", error);
  }

  const recipes = data.map((row) =>
    parseRow(sourceRecipeSchema, row, "load the recipes for your shopping list", idOfRow),
  );
  return recipeIds.flatMap((id) => recipes.find((recipe) => recipe.id === id) ?? []);
}

// A row core built is checked before it is sent, so a mistake is reported here by the paths that
// failed and never reaches the database, whose message could quote the row.
const writeOf = (row: ShoppingItemWrite, index: number, action: string): ShoppingItemWrite =>
  parseRow(shoppingItemWriteSchema, row, action, () => `at index ${index}`);

/**
 * Writes items of the list in one `save_shopping_items` call (ADR 0003, Amendment 15): a new row for
 * each item whose id is null, and the updatable columns of each existing one. It is all or nothing, so
 * a failure leaves the list as it was. Nothing is sent for no rows.
 */
export async function saveShoppingItems(
  client: SupabaseClient<Database>,
  rows: readonly ShoppingItemWrite[],
): Promise<void> {
  const action = "add to your shopping list";
  if (rows.length === 0) {
    return;
  }
  const items = rows.map((row, index) => writeOf(row, index, action));
  const { error } = await client.rpc("save_shopping_items", { p_items: items });

  if (error) {
    throw shoppingRepoError(action, error);
  }
}

/** Adds one item typed by hand and resolves to it as stored. The database gives it its id. */
export async function addShoppingItem(
  client: SupabaseClient<Database>,
  row: ShoppingItemWrite,
): Promise<ShoppingItem> {
  const action = "add the item";
  const item = writeOf(row, 0, action);
  const { data, error } = await client
    .from("shopping_list_items")
    .insert({
      food_id: item.food_id,
      name: item.name,
      grams: item.grams,
      portion_label: item.portion_label,
      portion_count: item.portion_count,
      sources: item.sources,
      position: item.position,
      checked_at: item.checked_at,
    })
    .select(ITEM_COLUMNS)
    .single();

  if (error) {
    throw shoppingRepoError(action, error);
  }

  return parseRow(shoppingItemSchema, data, action, idOfRow);
}

/**
 * Ticks an item, or unticks it with `checked: false`. The tick is stamped with this device's clock.
 * Nothing is ordered by it, so only whether it is set matters. An item that is not the user's is left
 * alone.
 */
export async function setShoppingItemChecked(
  client: SupabaseClient<Database>,
  id: string,
  checked: boolean,
): Promise<void> {
  const { error } = await client
    .from("shopping_list_items")
    .update({ checked_at: checked ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) {
    throw shoppingRepoError(checked ? "tick the item" : "untick the item", error);
  }
}

/** Removes one item from the list. An item that is not the user's is left alone. */
export async function deleteShoppingItem(
  client: SupabaseClient<Database>,
  id: string,
): Promise<void> {
  const { error } = await client.from("shopping_list_items").delete().eq("id", id);

  if (error) {
    throw shoppingRepoError("remove the item", error);
  }
}

/** Removes every ticked item of the user's list, and leaves what is still to buy. */
export async function clearTickedItems(client: SupabaseClient<Database>): Promise<void> {
  const { error } = await client.from("shopping_list_items").delete().not("checked_at", "is", null);

  if (error) {
    throw shoppingRepoError("clear the ticked items", error);
  }
}
