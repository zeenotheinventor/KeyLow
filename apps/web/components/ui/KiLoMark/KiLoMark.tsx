import type { KiLoMarkGlyphProps, KiLoMarkProps } from "./types";

import { cn } from "@/lib/utils";

const brandName = "Ki-Lo";

// The design system's mark, a calorie ring broken by a diagonal dumbbell. Its two colours are the
// accent and the primary text colour in both themes, so one drawing follows the theme and the
// separate on-light file is not needed.
function Mark({ title, className }: KiLoMarkGlyphProps) {
  return (
    <svg
      viewBox="0 0 256 256"
      fill="none"
      strokeWidth={22}
      strokeLinecap="round"
      className={cn("size-7 shrink-0", className)}
      {...(title === undefined ? { "aria-hidden": true } : { role: "img", "aria-label": title })}
    >
      <circle
        cx={128}
        cy={128}
        r={100}
        strokeDasharray="205 122"
        transform="rotate(-9 128 128)"
        className="stroke-accent"
      />
      <g className="stroke-text-primary">
        <line x1={72} y1={184} x2={184} y2={72} />
        <line x1={60} y1={150} x2={106} y2={196} />
        <line x1={150} y1={60} x2={196} y2={106} />
      </g>
    </svg>
  );
}

// With the wordmark, the mark and the word are one image named Ki-Lo, as the design system's
// BrandMark is. The word is drawn for the 40px mark the web auth cards use: the design system
// sets it at 0.62 of the mark's size (24.8px), semibold, with -0.04em tracking and a 12px gap.
// The word's ink is the accent in dark and primary text in light, as the accent ink token is.
export function KiLoMark(props: KiLoMarkProps) {
  if (props.wordmark !== true) {
    return <Mark {...props} />;
  }

  return (
    <span role="img" aria-label={brandName} className="inline-flex items-center gap-3">
      <Mark {...props} />
      <span className="text-[24.8px] font-semibold leading-none tracking-[-0.04em] text-text-primary">
        Ki<span className="text-accent-ink">-Lo</span>
      </span>
    </span>
  );
}
