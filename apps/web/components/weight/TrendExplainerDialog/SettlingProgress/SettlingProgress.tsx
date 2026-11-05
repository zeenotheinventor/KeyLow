import type { SettlingProgressProps } from "./types";

import { vars } from "@/lib/vars";

/**
 * The weigh-ins the trend has against the weigh-ins it needs, as the `explainer-settling` board draws it
 * inside the warning banner: a 6 px track on the raised surface with a warning fill, 8 px under the title (the banner keeps 2 of them). The banner's own words
 * say the count, so the bar is named and valued for a screen reader and draws no caption.
 */
export function SettlingProgress({ count, target, label }: SettlingProgressProps) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={count}
      className="mt-1.5 h-1.5 overflow-hidden rounded-pill bg-surface-raised"
    >
      {/* The fill's share of its track is a runtime number no class can name, so it goes through a variable. */}
      <div
        className="h-full w-[var(--settling-fill)] bg-warning"
        style={vars({ "--settling-fill": `${(count / target) * 100}%` })}
      />
    </div>
  );
}
