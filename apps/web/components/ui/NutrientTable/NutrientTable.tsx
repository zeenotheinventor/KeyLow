import { NOT_GIVEN } from "@keylow/core";

import type { NutrientTableProps } from "./types";

import { cn } from "@/lib/utils";

/** The nutrients of a food, one per row, with the values lined up on the right. A value the source does not give is written "not given", never 0. */
export function NutrientTable({ caption, rows, className }: NutrientTableProps) {
  return (
    <table
      className={cn(
        "w-full border-separate border-spacing-0 overflow-hidden rounded-large border border-border bg-surface tabular-nums",
        className,
      )}
    >
      <caption className="caption-top px-1 pb-2 text-left text-body-strong text-text-primary">
        {caption}
      </caption>
      <tbody>
        {rows.map((row, index) => {
          const divider = index > 0 && "border-t border-border";
          return (
            <tr key={row.label}>
              <th
                scope="row"
                className={cn(
                  "px-4 py-[10px] text-left text-body font-normal text-text-secondary",
                  divider,
                )}
              >
                {row.label}
              </th>
              <td
                className={cn(
                  "px-4 py-[10px] text-right text-body",
                  row.value === null
                    ? "font-normal text-text-muted"
                    : "font-semibold text-text-primary",
                  divider,
                )}
              >
                {row.value ?? NOT_GIVEN}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
