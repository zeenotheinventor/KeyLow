import { BODY_MAP, BODY_MAP_LEGEND_ITEMS, describeLegendCaption } from "@keylow/core/copy";
import { COMPARE_PARAMS_V2, VOLUME_BANDS_V2 } from "@keylow/core/training";

import type { BodyMapLegendProps } from "./types";

import { Card } from "@/components/ui/Card";

// Each scale's swatches are written next to its names, in the order of core's `BODY_MAP_LEGEND_ITEMS`, so a
// legend item can never be left without a colour. The classes are written out so Tailwind sees them. Heat
// goes from the rested step up to the peak, and only the peak glows. Volume starts with Not trained, and
// Gap with Not in plan, which is drawn in the same colour.
const swatchClassNames = {
  heat: [
    "bg-heat-0",
    "bg-heat-1",
    "bg-heat-2",
    "bg-heat-3",
    "bg-heat-4",
    "bg-heat-5 shadow-[0_0_8px_0] shadow-heat-glow",
  ],
  volume: [
    "bg-volume-not-trained",
    "bg-volume-maintaining",
    "bg-volume-growing",
    "bg-volume-productive",
    "bg-volume-high",
  ],
  gap: ["bg-volume-not-trained", "bg-gap-behind", "bg-gap-on-plan", "bg-gap-ahead"],
} as const;

// One column for each item, written out for the same reason.
const columnClassNames = {
  heat: "grid-cols-6",
  volume: "grid-cols-5",
  gap: "grid-cols-4",
} as const;

/**
 * The key to the colours of a scale beside the body map, as the web board draws it: a card with the scale's
 * name, a swatch over the name of each step, and a line on what the colours mean. The card is a region named
 * for the scale's legend. The swatches carry no meaning of their own, since each step's name is written
 * under it.
 */
export function BodyMapLegend({ scale }: BodyMapLegendProps) {
  const caption = describeLegendCaption({
    scale,
    surface: "web",
    onPlanToleranceSets: COMPARE_PARAMS_V2.onPlanToleranceSets,
    volumeBands: VOLUME_BANDS_V2,
  });

  return (
    <Card asChild padding="none">
      <section aria-label={BODY_MAP.legendNames[scale]} className="flex flex-col gap-2 p-4">
        <h2 className="text-body-strong">{BODY_MAP.scaleSwitch[scale]}</h2>
        <ul className={`grid gap-1 ${columnClassNames[scale]}`}>
          {BODY_MAP_LEGEND_ITEMS[scale].map((name, position) => (
            <li key={name} className="flex flex-col items-center gap-1">
              <span
                aria-hidden
                className={`block h-[10px] w-full rounded-[3px] ${swatchClassNames[scale][position]}`}
              />
              <span className="whitespace-nowrap text-caption text-text-secondary">{name}</span>
            </li>
          ))}
        </ul>
        <p className="text-caption text-text-muted">{caption}</p>
      </section>
    </Card>
  );
}
