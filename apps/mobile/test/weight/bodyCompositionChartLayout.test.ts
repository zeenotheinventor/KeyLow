// The layout is the figure's own, so this reads it from its file and not from the folder's public surface.
import {
  CAPTION_HEIGHT,
  FIGURE_TOP_INSET,
  PLOT_GAP,
  PLOT_HEIGHT,
  SECOND_PLOT_TOP,
  VALUE_COLUMN_WIDTH,
  X_LABELS_TOP,
  emptyGridOffsets,
  plotOffsetOf,
  plotPadding,
} from "../../components/BodyCompositionChart/layout";
import { compileAppStyles } from "../support/nativeWindStyles";

// The first declaration of a class, such as 12 for `top: 12px`. NativeWind inlines a rem as 14 points in this app.
async function pixelsOf(className: string): Promise<number> {
  const css = await compileAppStyles(className);
  const escaped = className.replace(/[[\]]/g, "\\$&");
  const rule = css.slice(css.indexOf(`.${escaped} {`));
  const declaration = /: (-?\d+(?:\.\d+)?)(px|rem)/.exec(rule);
  return Number(declaration?.[1]) * (declaration?.[2] === "rem" ? 14 : 1);
}

describe("the body composition chart's room", () => {
  it("should give the figure's classes the numbers the drawing counts on", async () => {
    expect(await pixelsOf("top-3")).toBe(FIGURE_TOP_INSET);
    expect(await pixelsOf("h-[76px]")).toBe(PLOT_HEIGHT);
    expect(await pixelsOf("top-[96px]")).toBe(SECOND_PLOT_TOP);
    expect(await pixelsOf("top-[172px]")).toBe(X_LABELS_TOP);
    expect(await pixelsOf("right-10")).toBe(VALUE_COLUMN_WIDTH);
    expect(await pixelsOf("pr-[44px]")).toBe(plotPadding.right);
    expect(await pixelsOf("left-3")).toBe(plotPadding.left);
    expect(await pixelsOf("h-[14px]")).toBe(CAPTION_HEIGHT);
  });

  it("should split the plot box into two plots of 76 points with 8 points between them", () => {
    expect(PLOT_HEIGHT).toBe(76);
    expect(PLOT_GAP).toBe(8);
    expect(SECOND_PLOT_TOP).toBe(FIGURE_TOP_INSET + PLOT_HEIGHT + PLOT_GAP);
  });

  it("should leave the x labels where the weight chart has them, under the second plot", () => {
    expect(X_LABELS_TOP).toBe(172);
    expect(X_LABELS_TOP).toBe(SECOND_PLOT_TOP + PLOT_HEIGHT);
  });

  it("should keep the value column and 4 points beside it right of the plot", () => {
    expect(plotPadding.right).toBe(VALUE_COLUMN_WIDTH + 4);
    expect(plotPadding.left).toBe(12);
  });

  it("should keep the top gridline of a plot below its caption", () => {
    expect(plotPadding.top).toBeGreaterThan(CAPTION_HEIGHT);
  });

  it("should draw the highest value at the top padding and the lowest at the bottom padding", () => {
    const axis = { min: 80, max: 100 };

    expect(plotOffsetOf(100, axis)).toBe(plotPadding.top);
    expect(plotOffsetOf(80, axis)).toBe(PLOT_HEIGHT - plotPadding.bottom);
    expect(plotOffsetOf(90, axis)).toBe((plotPadding.top + PLOT_HEIGHT - plotPadding.bottom) / 2);
  });

  it("should draw the grid of an empty range at the top, the middle and the bottom of the plot", () => {
    expect(emptyGridOffsets).toEqual([16, 42, 68]);
  });
});
