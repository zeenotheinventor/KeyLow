import { portionId } from "./portionId";
import { sqlLiteral } from "../cofid/sqlLiteral";

import type { PortionRow } from "./portionRows";

const COLUMNS = ["id", "food_id", "owner_id", "label", "grams", "ml", "is_default", "position"];
const UPDATED_COLUMNS = COLUMNS.filter((column) => column !== "id" && column !== "owner_id");

const foodOf = (foodCode: string): string =>
  `select id from public.foods where source = 'cofid' and source_ref = ${sqlLiteral(foodCode)}`;

/** Clears the old default of a food, so a default that moves never leaves two of them, which the one-default-per-food index forbids. */
const clearOtherDefaults = ({ foodCode, label }: PortionRow): string =>
  `update public.food_portions set is_default = false where food_id = (${foodOf(foodCode)}) and owner_id is null and is_default and id <> ${sqlLiteral(portionId(foodCode, label))};`;

const insertPortion = ({ foodCode, label, grams, ml, isDefault, position }: PortionRow): string =>
  [
    `insert into public.food_portions (${COLUMNS.join(", ")})`,
    `select ${[sqlLiteral(portionId(foodCode, label)), "foods.id", "null", sqlLiteral(label), sqlLiteral(grams), sqlLiteral(ml), isDefault ? "true" : "false", sqlLiteral(position)].join(", ")}`,
    `from public.foods where source = 'cofid' and source_ref = ${sqlLiteral(foodCode)}`,
    `on conflict (id) do update set ${UPDATED_COLUMNS.map((column) => `${column} = excluded.${column}`).join(", ")}`,
    "where public.food_portions.owner_id is null;",
  ].join(" ");

/**
 * The statements that write the portions, shared by the seed and the migration so the two cannot
 * differ. Each row is selected from the food with its code, so a database without that food gets no
 * row, and each is upserted on its id, so applying them again changes nothing. Only shared portions
 * (`owner_id is null`) are cleared or updated. A food's default is cleared before its rows are
 * written. The statements depend only on the rows, in the order the file lists them, grouped by food.
 */
export function portionStatements(rows: readonly PortionRow[]): string[] {
  const rowsByFood = new Map<string, PortionRow[]>();
  for (const row of rows) {
    rowsByFood.set(row.foodCode, [...(rowsByFood.get(row.foodCode) ?? []), row]);
  }
  const statementsOfFood = (foodRows: readonly PortionRow[]): string[] => [
    ...foodRows.filter(({ isDefault }) => isDefault).map(clearOtherDefaults),
    ...foodRows.map(insertPortion),
  ];
  return [...rowsByFood.values()].flatMap(statementsOfFood);
}
