import { buildBodyFigureSvg } from "@keylow/core/widgets";
import { FlexWidget, SvgWidget } from "react-native-android-widget";

import type { BodyFiguresProps } from "./types";

const FIGURE_HEIGHT = 140;
// The figure's viewBox is 144 by 432, so 140 points high is 47 wide.
const FIGURE_WIDTH = 47;

/** The front and the back of the body side by side, drawn from the app's own artwork. */
export function BodyFigures({ figure, theme }: BodyFiguresProps) {
  const palette = theme.palette;

  return (
    <FlexWidget style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
      <SvgWidget
        svg={buildBodyFigureSvg({ figure, side: "front", palette, height: FIGURE_HEIGHT })}
        style={{ width: FIGURE_WIDTH, height: FIGURE_HEIGHT }}
      />
      <FlexWidget style={{ marginLeft: 14 }}>
        <SvgWidget
          svg={buildBodyFigureSvg({ figure, side: "back", palette, height: FIGURE_HEIGHT })}
          style={{ width: FIGURE_WIDTH, height: FIGURE_HEIGHT }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
