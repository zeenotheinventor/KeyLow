import { View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";

import { useTheme } from "../../lib/theme";

import type { KiLoMarkProps } from "./types";

/**
 * The Ki-Lo mark, as the approved brand drawing (`mark.svg`) has it: an open arc with a bar across it.
 * The arc is the theme's accent and the bars are its primary text, which is what the design's dark and
 * light variants are, so it follows the scheme.
 */
export function KiLoMark({ size, label }: KiLoMarkProps) {
  const { colors } = useTheme();
  const bar = { stroke: colors["text-primary"], strokeWidth: 22, strokeLinecap: "round" } as const;

  const drawing = (
    <Svg aria-hidden height={size} viewBox="0 0 256 256" width={size}>
      <Circle
        cx={128}
        cy={128}
        fill="none"
        r={100}
        stroke={colors.accent}
        strokeDasharray="205 122"
        strokeLinecap="round"
        strokeWidth={22}
        transform="rotate(-9 128 128)"
      />
      <Line x1={72} x2={184} y1={184} y2={72} {...bar} />
      <Line x1={60} x2={106} y1={150} y2={196} {...bar} />
      <Line x1={150} x2={196} y1={60} y2={106} {...bar} />
    </Svg>
  );

  return label === undefined ? (
    drawing
  ) : (
    <View accessible aria-label={label} role="img">
      {drawing}
    </View>
  );
}
