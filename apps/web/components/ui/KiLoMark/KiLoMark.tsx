import type { KiLoMarkProps } from "./types";

import { cn } from "@/lib/utils";

// The design system's mark, a calorie ring broken by a diagonal dumbbell. Its two colours are the
// accent and the primary text colour in both themes, so one drawing follows the theme and the
// separate on-light file is not needed.
export function KiLoMark({ title, className }: KiLoMarkProps) {
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
