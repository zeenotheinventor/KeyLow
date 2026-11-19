import { BADGE_GRADIENTS, BADGE_VIEW_BOX_SIZE, badgeDrawing } from "@keylow/core";
import { achievementBadgeLabel } from "@keylow/core/copy";
import { useId } from "react";

import { fillClassNames, stopColourClassNames, strokeClassNames } from "./tierColourClassNames";

import type { AchievementBadgeProps } from "./types";
import type { BadgePaint, BadgeShape, TierColourToken } from "@keylow/core";

/**
 * A struck medal for an achievement: a tier frame, a dark enamel centre, the series motif and, on a series
 * badge, a ribbon with its threshold. What to draw comes from `badgeDrawing` in core, so the web and a phone
 * draw the same badge. The metals are gradients under ids of this badge's own, because several badges share a
 * page. The tier colours are the same in light and dark. It is an image named by its label, or decoration
 * assistive technology skips when the row beside it already says the name.
 */
export function AchievementBadge({
  id,
  state = "earned",
  size,
  progress,
  decorative = false,
}: AchievementBadgeProps) {
  const gradientPrefix = `badge${useId().replaceAll(/\W/g, "")}`;
  const { shapes, gradients } = badgeDrawing(id, state);

  // A gradient is a `url()` attribute, which browsers resolve. Every other colour is a class over a theme variable.
  const colours = (fill: BadgePaint | undefined, stroke: TierColourToken | undefined) => {
    const strokeClassName = stroke === undefined ? "" : strokeClassNames[stroke];
    if (fill !== undefined && "gradient" in fill) {
      return { className: strokeClassName, fill: `url(#${gradientPrefix}-${fill.gradient})` };
    }
    const fillClassName = fill === undefined ? "fill-none" : fillClassNames[fill.token];
    return { className: `${fillClassName} ${strokeClassName}` };
  };

  const draw = (shape: BadgeShape, key: number) => {
    switch (shape.kind) {
      case "circle":
        return (
          <circle
            cx={32}
            cy={32}
            key={key}
            r={shape.radius}
            strokeWidth={shape.strokeWidth}
            {...colours(shape.fill, shape.stroke)}
          />
        );
      case "path":
        return (
          <path
            d={shape.d}
            key={key}
            opacity={shape.opacity}
            strokeLinecap={shape.rounded === true ? "round" : undefined}
            strokeLinejoin={shape.rounded === true ? "round" : undefined}
            strokeWidth={shape.strokeWidth}
            {...colours(shape.fill, shape.stroke)}
          />
        );
      case "text":
        return (
          <text
            className={`font-sans font-bold ${fillClassNames[shape.fill]}`}
            fontSize={shape.fontSize}
            key={key}
            textAnchor="middle"
            x={shape.x}
            y={shape.y}
          >
            {shape.text}
          </text>
        );
      case "group":
        return (
          <g key={key} transform={`translate(${shape.translateX} ${shape.translateY})`}>
            {shape.shapes.map(draw)}
          </g>
        );
    }
  };

  return (
    <svg
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : achievementBadgeLabel({ id, state, progress })}
      className="block shrink-0"
      height={size}
      role={decorative ? undefined : "img"}
      viewBox={`0 0 ${BADGE_VIEW_BOX_SIZE} ${BADGE_VIEW_BOX_SIZE}`}
      width={size}
    >
      <defs>
        {gradients.map((name) => (
          <linearGradient
            id={`${gradientPrefix}-${name}`}
            key={name}
            x1={BADGE_GRADIENTS[name].x1}
            x2={BADGE_GRADIENTS[name].x2}
            y1={BADGE_GRADIENTS[name].y1}
            y2={BADGE_GRADIENTS[name].y2}
          >
            {BADGE_GRADIENTS[name].stops.map((stop) => (
              <stop
                className={stopColourClassNames[stop.token]}
                key={stop.offset}
                offset={stop.offset}
              />
            ))}
          </linearGradient>
        ))}
      </defs>
      {shapes.map(draw)}
    </svg>
  );
}
