import { BODY_MAP } from "@keylow/core/copy";

// From High down to Not trained. Only Not trained has a border, because it is the one band that could pass
// for the card behind it. The classes are written out so Tailwind sees them.
const volumeSwatchClassNames = [
  "bg-volume-high",
  "bg-volume-productive",
  "bg-volume-growing",
  "bg-volume-maintaining",
  "border border-border-strong bg-volume-not-trained",
];

/**
 * The volume legend as the small body map cards draw it beside the figures: five swatches in a column from
 * High at the top down to Not trained, with the names of the two ends. It is one image named for the volume
 * legend.
 */
export function VolumeLegendStrip() {
  return (
    <div
      role="img"
      aria-label={BODY_MAP.legendNames.volume}
      className="flex flex-col items-start gap-[3px] pb-[6px]"
    >
      <p className="text-caption text-text-muted">{BODY_MAP.dashboardCard.volumeTopStep}</p>
      {volumeSwatchClassNames.map((swatchClassName) => (
        <span
          key={swatchClassName}
          className={`block h-[14px] w-[10px] rounded-[3px] ${swatchClassName}`}
        />
      ))}
      <p className="text-caption text-text-muted">{BODY_MAP.dashboardCard.volumeBottomStep}</p>
    </div>
  );
}
