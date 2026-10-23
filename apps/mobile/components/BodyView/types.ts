import type { BodyFigureProps } from "../ui";

/**
 * `BodyView` takes the props of `BodyFigure` unchanged, so a screen swaps one for the other. 3D has no
 * colours or touch yet, so in 3D the label and the width are the only props it reads.
 */
export type BodyViewProps = BodyFigureProps;
