import { describeFoodsAtHour } from "@keylow/core/copy";

import { entryRowFields } from "../entryRowFields";

import type { HourFoodsProps } from "./types";

import { FoodRow } from "@/components/ui/FoodRow";
import { FoodTable } from "@/components/ui/FoodTable";

/**
 * An hour's foods in two shapes, one of which the width hides: at 768 px and up a table with Edit and
 * Delete on each row, below it stacked rows that open the edit dialog when pressed. Both are in the page,
 * because the width decides which is shown.
 */
export function HourFoods({
  label,
  entries,
  timeZone,
  deleteDisabled,
  onEdit,
  onDelete,
}: HourFoodsProps) {
  return (
    <>
      <FoodTable label={describeFoodsAtHour(label)}>
        {entries.map((entry) => {
          const row = entryRowFields(entry, timeZone);

          return (
            <FoodRow
              key={entry.id}
              layout="table"
              nameSegments={row.nameSegments}
              caption={row.caption}
              energy={row.energy}
              macros={row.cells}
              deleteDisabled={deleteDisabled}
              onEdit={() => {
                onEdit(entry);
              }}
              onDelete={() => {
                onDelete(entry);
              }}
            />
          );
        })}
      </FoodTable>
      <ul className="divide-y divide-border md:hidden">
        {entries.map((entry) => {
          const row = entryRowFields(entry, timeZone);

          return (
            <FoodRow
              key={entry.id}
              layout="stacked"
              nameSegments={row.nameSegments}
              caption={row.caption}
              energy={row.energy}
              macros={row.macros}
              needsReview={row.macros === undefined}
              onClick={() => {
                onEdit(entry);
              }}
            />
          );
        })}
      </ul>
    </>
  );
}
