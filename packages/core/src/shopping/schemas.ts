import { z } from "zod";

import {
  MAX_SHOPPING_ITEM_GRAMS,
  MAX_SHOPPING_ITEM_NAME_LENGTH,
  MAX_SHOPPING_ITEM_SOURCES,
  MAX_SHOPPING_PORTION_COUNT,
  MAX_SHOPPING_PORTION_LABEL_LENGTH,
} from "./bounds";
import { MAX_RECIPE_NAME_LENGTH } from "../recipes/bounds";
import { characterCount } from "../recipes/characterCount";

const rowIdSchema = z.guid();

const textOfAtMost = (maximumLength: number) =>
  z
    .string()
    .refine((text) => text.trim() !== "", { message: "Text must not be blank" })
    .refine((text) => characterCount(text) <= maximumLength, {
      message: `Text must be at most ${maximumLength} characters`,
    });

/** A recipe an item came from, with its name as it was when the item was added. */
export const shoppingSourceSchema = z.object({
  recipeId: rowIdSchema,
  name: textOfAtMost(MAX_RECIPE_NAME_LENGTH),
});

const itemFields = {
  /** Null for an item typed by hand, or one whose food was deleted since. */
  food_id: rowIdSchema.nullable(),
  name: textOfAtMost(MAX_SHOPPING_ITEM_NAME_LENGTH),
  grams: z.number().positive().max(MAX_SHOPPING_ITEM_GRAMS).nullable(),
  portion_label: textOfAtMost(MAX_SHOPPING_PORTION_LABEL_LENGTH).nullable(),
  portion_count: z.number().positive().max(MAX_SHOPPING_PORTION_COUNT).nullable(),
  sources: z.array(shoppingSourceSchema).max(MAX_SHOPPING_ITEM_SOURCES),
  position: z.number().int().nonnegative(),
  /** When the item was ticked, as the database writes a timestamp. Null is still to buy. */
  checked_at: z.string().nullable(),
};

type PortionColumns = { portion_label: string | null; portion_count: number | null };

// The label and the count are both set or both null, as the table's check requires.
const withPairedPortion = <Item extends PortionColumns>(schema: z.ZodType<Item>): z.ZodType<Item> =>
  schema.refine((item) => (item.portion_label === null) === (item.portion_count === null), {
    message: "A portion label and a portion count go together",
    path: ["portion_count"],
  });

/** A `shopping_list_items` row as the list reads it (ADR 0003, Amendment 15). */
export const shoppingItemSchema = withPairedPortion(z.object({ id: rowIdSchema, ...itemFields }));

/**
 * One item as `save_shopping_items` takes it: an id of the caller's to update, or null for a new row
 * that the database gives an id. The owner and `created_at` are not here, because the call never sets them.
 */
export const shoppingItemWriteSchema = withPairedPortion(
  z.object({ id: rowIdSchema.nullable(), ...itemFields }),
);

export type ShoppingSource = z.infer<typeof shoppingSourceSchema>;
export type ShoppingItem = z.infer<typeof shoppingItemSchema>;
export type ShoppingItemWrite = z.infer<typeof shoppingItemWriteSchema>;
