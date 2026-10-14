import { View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";

import { useTheme } from "../../lib/theme";

const markSize = 112;

/**
 * What covers the app while the stored session is read, as the tab shell's session-loading board draws it:
 * the Ki-Lo mark alone, centred at 112 points on the background. The mark is the approved brand drawing
 * (`mark.svg`), with its lime arc and its light bars taken from the theme, which is what the design's dark
 * and light variants are. The mark is decoration, so the cover is what is announced.
 */
export function SessionCover() {
  const { colors } = useTheme();
  const bar = { stroke: colors["text-primary"], strokeWidth: 22, strokeLinecap: "round" } as const;

  return (
    <View
      accessible
      aria-label="Ki-Lo"
      className="absolute inset-0 items-center justify-center bg-background"
      role="img"
    >
      <Svg aria-hidden height={markSize} viewBox="0 0 256 256" width={markSize}>
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
    </View>
  );
}
