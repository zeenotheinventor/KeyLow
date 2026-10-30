import { BODY_MAP, BODY_MAP_LEGEND_ITEMS, describeLegendCaption } from "@keylow/core/copy";
import { COMPARE_PARAMS_V2, VOLUME_BANDS_V2 } from "@keylow/core/training";

import { Card } from "@/components/ui/Card";

// From the rested step up to the peak, in the order of core's `BODY_MAP_LEGEND_ITEMS.heat`, and only the
// peak glows. The classes are written out so Tailwind sees them.
const heatSwatchClassNames = [
  "bg-heat-0",
  "bg-heat-1",
  "bg-heat-2",
  "bg-heat-3",
  "bg-heat-4",
  "bg-heat-5 shadow-[0_0_8px_0] shadow-heat-glow",
] as const;

const caption = describeLegendCaption({
  scale: "heat",
  surface: "web",
  onPlanToleranceSets: COMPARE_PARAMS_V2.onPlanToleranceSets,
  volumeBands: VOLUME_BANDS_V2,
});

/**
 * The key to the heat colours beside the body map, as the web board draws it: a card with the scale's name,
 * a swatch over the name of each of the six steps from Rested to Peak, and a line on what the colours mean.
 * The card is a region named for the heat legend. The swatches carry no meaning of their own, since each
 * step's name is written under it.
 */
export function BodyMapLegend() {
  return (
    <Card asChild padding="none">
      <section aria-label={BODY_MAP.legendNames.heat} className="flex flex-col gap-2 p-4">
        <h2 className="text-body-strong">{BODY_MAP.scaleSwitch.heat}</h2>
        <div className="grid grid-cols-6 gap-1">
          {BODY_MAP_LEGEND_ITEMS.heat.map((name, step) => (
            <div key={name} className="flex flex-col items-center gap-1">
              <span
                aria-hidden
                className={`block h-[10px] w-full rounded-[3px] ${heatSwatchClassNames[step]}`}
              />
              <span className="whitespace-nowrap text-caption text-text-secondary">{name}</span>
            </div>
          ))}
        </div>
        <p className="text-caption text-text-muted">{caption}</p>
      </section>
    </Card>
  );
}
