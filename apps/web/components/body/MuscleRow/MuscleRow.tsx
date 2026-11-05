import { describeMuscleListRow } from "@keylow/core/copy";

import type { MuscleRowProps } from "./types";

// The swatch of each heat step, from Rested to Peak. The classes are written out so Tailwind sees them.
const swatchClassNames = [
  "bg-heat-0",
  "bg-heat-1",
  "bg-heat-2",
  "bg-heat-3",
  "bg-heat-4",
  "bg-heat-5",
];

/**
 * One muscle of the Muscles card and of the muscle list, as `web-body, actual-heat` draws it: a swatch in the
 * colour of its heat step, the name, the status ("Hot · ready in 31 h") and the percent. The whole row is one
 * button that opens the muscle's sheet, named in words ("Hamstrings, heat 55 percent, hot, ready in 31 hours,
 * open details"), so the swatch's colour is never the only way to read the heat. Below 700 px the status sits
 * under the name. It is a list item, so put it in a list.
 */
export function MuscleRow({ row, onOpen }: MuscleRowProps) {
  const { name, status, heatText, accessibleName } = describeMuscleListRow(row);

  return (
    <li>
      <button
        type="button"
        aria-label={accessibleName}
        onClick={(event) => {
          onOpen(event.currentTarget);
        }}
        className="flex min-h-touch-target w-full items-center gap-3 px-4 py-1.5 text-left text-text-primary outline-none transition-colors duration-quick hover:bg-hover-overlay active:bg-press-overlay focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
      >
        <span
          aria-hidden
          className={`size-[14px] shrink-0 rounded-[4px] ${swatchClassNames[row.heatStep] ?? swatchClassNames[0]}`}
        />
        <span className="flex min-w-0 flex-1 flex-col min-[700px]:flex-row min-[700px]:items-center min-[700px]:gap-3">
          <span className="text-body min-[700px]:flex-1">{name}</span>
          <span className="text-caption text-text-secondary min-[700px]:w-[150px]">{status}</span>
        </span>
        <span className="w-12 shrink-0 text-right text-body-strong tabular-nums">{heatText}</span>
      </button>
    </li>
  );
}
