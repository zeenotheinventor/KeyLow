import { describeFoodsAtHour } from "@keylow/core/copy";

import { entryRowFields } from "../entryRowFields";

import type { HourFoodsProps } from "./types";

import { FoodRow } from "@/components/ui/FoodRow";
import { FoodTable } from "@/components/ui/FoodTable";

/**
 * An hour's foods in two shapes, one of which the width hides: at 768 px and up a table with Delete on
 * each row, below it stacked rows. Both are in the page, because the width decides which is shown. There
 * is no Edit button and a stacked row is plain text until the edit dialog exists (KEY-211): pass `onEdit`
 * to the rows then.
 */
export function HourFoods({ label, entries, timeZone, onDelete }: HourFoodsProps) {
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
            />
          );
        })}
      </ul>
    </>
  );
}
