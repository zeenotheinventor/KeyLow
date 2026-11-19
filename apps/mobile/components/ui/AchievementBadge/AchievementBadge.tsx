import { BADGE_GRADIENTS, BADGE_VIEW_BOX_SIZE, badgeDrawing } from "@keylow/core";
import { achievementBadgeLabel } from "@keylow/core/copy";
import { useId } from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { useTheme } from "../../../lib/theme";

import type { AchievementBadgeProps } from "./types";
import type { BadgePaint, BadgeShape } from "@keylow/core";

// The ribbon's threshold. Geist has no bold file in the app, so the semibold one stands in for the board's 700.
const RIBBON_FONT_FAMILY = "Geist-SemiBold";

/**
 * A struck medal for an achievement: a tier frame, a dark enamel centre, the series motif and, on a series
 * badge, a ribbon with its threshold. What to draw comes from `badgeDrawing` in core, so a phone and the web
 * draw the same badge. The metals are gradients under ids of this badge's own, because several badges share a
 * screen. The tier colours are the same in light and dark. It is an image named by its label, or decoration a
 * screen reader skips when the row beside it already says the name.
 */
export function AchievementBadge({
  id,
  state = "earned",
  size,
  progress,
  decorative = false,
}: AchievementBadgeProps) {
  const { colors } = useTheme();
  const gradientPrefix = `badge${useId().replaceAll(/\W/g, "")}`;
  const { shapes, gradients } = badgeDrawing(id, state);

  const paint = (fill: BadgePaint | undefined) => {
    if (fill === undefined) {
      return "none";
    }
    return "gradient" in fill ? `url(#${gradientPrefix}-${fill.gradient})` : colors[fill.token];
  };
  // A prop left out is not the same as a prop that is undefined, so the optional ones are spread in.
  const stroke = (shape: Extract<BadgeShape, { kind: "circle" | "path" }>) =>
    shape.stroke === undefined || shape.strokeWidth === undefined
      ? {}
      : { stroke: colors[shape.stroke], strokeWidth: shape.strokeWidth };

  const draw = (shape: BadgeShape, key: number) => {
    switch (shape.kind) {
      case "circle":
        return (
          <Circle
            cx={32}
            cy={32}
            fill={paint(shape.fill)}
            key={key}
            r={shape.radius}
            {...stroke(shape)}
          />
        );
      case "path":
        return (
          <Path
            d={shape.d}
            fill={paint(shape.fill)}
            key={key}
            {...(shape.opacity === undefined ? {} : { opacity: shape.opacity })}
            {...(shape.rounded === true
              ? ({ strokeLinecap: "round", strokeLinejoin: "round" } as const)
              : {})}
            {...stroke(shape)}
          />
        );
      case "text":
        return (
          <SvgText
            fill={colors[shape.fill]}
            fontFamily={RIBBON_FONT_FAMILY}
            fontSize={shape.fontSize}
            key={key}
            textAnchor="middle"
            transform={[{ translateX: shape.x }, { translateY: shape.y }]}
          >
            {shape.text}
          </SvgText>
        );
      case "group":
        return (
          <G
            key={key}
            transform={[{ translateX: shape.translateX }, { translateY: shape.translateY }]}
          >
            {shape.shapes.map(draw)}
          </G>
        );
    }
  };

  const accessibility = decorative
    ? ({ "aria-hidden": true } as const)
    : ({
        accessible: true,
        role: "img",
        "aria-label": achievementBadgeLabel({ id, state, progress }),
      } as const);

  return (
    <View {...accessibility}>
      <Svg height={size} viewBox={`0 0 ${BADGE_VIEW_BOX_SIZE} ${BADGE_VIEW_BOX_SIZE}`} width={size}>
        <Defs>
          {gradients.map((name) => (
            <LinearGradient
              id={`${gradientPrefix}-${name}`}
              key={name}
              x1={BADGE_GRADIENTS[name].x1}
              x2={BADGE_GRADIENTS[name].x2}
              y1={BADGE_GRADIENTS[name].y1}
              y2={BADGE_GRADIENTS[name].y2}
            >
              {BADGE_GRADIENTS[name].stops.map((stop) => (
                <Stop key={stop.offset} offset={stop.offset} stopColor={colors[stop.token]} />
              ))}
            </LinearGradient>
          ))}
        </Defs>
        {shapes.map(draw)}
      </Svg>
    </View>
  );
}
