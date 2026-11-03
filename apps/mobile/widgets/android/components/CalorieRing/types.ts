import type { WidgetTheme } from "../../theme";
import type { RingView } from "@keylow/core/widgets";

export type CalorieRingProps = Readonly<{
  ring: RingView;
  /** Compact is the small widget's ring, regular the medium and large ones'. */
  size: "compact" | "regular";
  theme: WidgetTheme;
  /** The drawn width and height, when the board shrinks the regular ring (the large widget draws 104). */
  dimension?: number;
}>;
