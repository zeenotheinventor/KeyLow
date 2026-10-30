"use client";

import { MUSCLE_NAMES } from "@keylow/core/copy";
import { BODY_ARTWORK, BODY_GLOW_FILTER, isMuscleId, readMuscleValue } from "@keylow/core/training";
import { useId } from "react";

import {
  focusRingClasses,
  selectedOutlineClass,
  SELECTED_OUTLINE_WIDTH,
  separatorClass,
  SEPARATOR_WIDTH,
  silhouetteClass,
  toneFillClasses,
} from "./muscleClasses";
import { useMusclePointer } from "./useMusclePointer";

import type { BodyFigureProps } from "./types";
import type { KeyboardEvent, MouseEvent } from "react";

import { cn } from "@/lib/utils";

const VIEW_BOX_WIDTH = 200;
const VIEW_BOX_HEIGHT = 440;

/**
 * One side of the body as a drawing of the 22 muscles, filled from the heat, volume, gap or role scale. With
 * no handler it is one image with the label. With a handler, each muscle is a button named by the muscle and
 * its value, reached by Tab, and a click anywhere else on the figure goes to the screen around it.
 * A pointer that moves past the tap slop from where it went down neither clicks nor holds a muscle.
 */
export function BodyFigure({
  side,
  scale,
  values,
  body = "male",
  selected,
  dim = 1,
  unselectedOpacity = 1,
  label,
  w,
  onPressMuscle,
  onLongPressMuscle,
}: BodyFigureProps) {
  // One filter for each figure, so two figures on a page never share a name. The name is also kept to
  // letters and digits, which is all the SVG reference reads reliably.
  const glowName = `glow${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const { figure, startHold } = useMusclePointer(onLongPressMuscle);
  const artwork = BODY_ARTWORK[body][side];
  const hasHandler = onPressMuscle !== undefined || onLongPressMuscle !== undefined;

  const muscles = Object.entries(artwork.muscles).flatMap(([id, path]) =>
    isMuscleId(id) ? [{ id, path, ...readMuscleValue(scale, values[id]) }] : [],
  );
  const hasGlow = muscles.some((muscle) => muscle.isPeak);
  // The key that opens the details, when the screen has them, and otherwise presses the muscle.
  const pressWithKeyboard = onLongPressMuscle ?? onPressMuscle;

  return (
    <svg
      aria-label={label}
      className="block shrink-0 select-none overflow-visible"
      height={(w * VIEW_BOX_HEIGHT) / VIEW_BOX_WIDTH}
      role={hasHandler ? "group" : "img"}
      viewBox={artwork.viewBox}
      width={w}
      {...(hasHandler ? figure : {})}
    >
      {hasGlow && (
        <defs>
          <filter
            height={BODY_GLOW_FILTER.height}
            id={glowName}
            width={BODY_GLOW_FILTER.width}
            x={BODY_GLOW_FILTER.x}
            y={BODY_GLOW_FILTER.y}
          >
            <feGaussianBlur
              in="SourceGraphic"
              result="blur"
              stdDeviation={BODY_GLOW_FILTER.standardDeviation}
            />
            <feMerge>
              {BODY_GLOW_FILTER.mergeLayers.map((layer, position) => (
                <feMergeNode
                  key={`${layer}-${position}`}
                  in={layer === "blur" ? "blur" : "SourceGraphic"}
                />
              ))}
            </feMerge>
          </filter>
        </defs>
      )}
      <g opacity={dim}>
        <path className={silhouetteClass} d={artwork.head} />
        <path className={silhouetteClass} d={artwork.outline} />
        {muscles.map((muscle) => {
          const isSelected = muscle.id === selected;
          const appearance = {
            className: cn(
              toneFillClasses[muscle.tone],
              isSelected ? selectedOutlineClass : separatorClass,
            ),
            d: muscle.path,
            opacity: selected !== undefined && !isSelected ? unselectedOpacity : 1,
            strokeLinejoin: "round",
            strokeWidth: isSelected ? SELECTED_OUTLINE_WIDTH : SEPARATOR_WIDTH,
            ...(muscle.isPeak ? { filter: `url(#${glowName})` } : {}),
          } as const;

          if (!hasHandler) {
            return <path key={muscle.id} {...appearance} />;
          }
          return (
            <path
              key={muscle.id}
              {...appearance}
              aria-label={`${MUSCLE_NAMES[muscle.id]}, ${muscle.valueName}`}
              className={cn(appearance.className, "cursor-pointer", focusRingClasses)}
              onClick={(event: MouseEvent) => {
                event.stopPropagation();
                onPressMuscle?.(muscle.id);
              }}
              onContextMenu={(event: MouseEvent) => {
                // A touch hold opens the browser's menu on some phones, and the hold is the details.
                if (onLongPressMuscle !== undefined) {
                  event.preventDefault();
                }
              }}
              onKeyDown={(event: KeyboardEvent) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  // A key held down repeats, and must press once. Space still never scrolls the page.
                  if (!event.repeat) {
                    pressWithKeyboard?.(muscle.id);
                  }
                }
              }}
              onPointerDown={startHold(muscle.id)}
              role="button"
              tabIndex={0}
            />
          );
        })}
      </g>
    </svg>
  );
}
