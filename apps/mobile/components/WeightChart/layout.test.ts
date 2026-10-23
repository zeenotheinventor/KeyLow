import {
  FIGURE_TOP_INSET,
  PLOT_BOX_HEIGHT,
  VALUE_COLUMN_WIDTH,
  X_LABELS_TOP,
  emptyGridOffsets,
  plotOffsetOf,
  plotPadding,
} from "./layout";
import { compileAppStyles } from "../../test/support/nativeWindStyles";

// The first declaration of a class, such as 12 for `top: 12px`. NativeWind inlines a rem as 14 points in this app.
async function pixelsOf(className: string): Promise<number> {
  const css = await compileAppStyles(className);
  const escaped = className.replace(/[[\]]/g, "\\$&");
  const rule = css.slice(css.indexOf(`.${escaped} {`));
  const declaration = /: (-?\d+(?:\.\d+)?)(px|rem)/.exec(rule);
  return Number(declaration?.[1]) * (declaration?.[2] === "rem" ? 14 : 1);
}

describe("the weight chart's room", () => {
  it("should give the figure's classes the numbers the drawing counts on", async () => {
    expect(await pixelsOf("top-3")).toBe(FIGURE_TOP_INSET);
    expect(await pixelsOf("h-[160px]")).toBe(PLOT_BOX_HEIGHT);
    expect(await pixelsOf("right-10")).toBe(VALUE_COLUMN_WIDTH);
    expect(await pixelsOf("top-[172px]")).toBe(X_LABELS_TOP);
    expect(await pixelsOf("pr-[44px]")).toBe(plotPadding.right);
  });

  it("should start the x labels where the plot's box ends", () => {
    expect(X_LABELS_TOP).toBe(FIGURE_TOP_INSET + PLOT_BOX_HEIGHT);
  });

  it("should leave the board's room round the plot", () => {
    expect(plotPadding).toEqual({ left: 12, right: 44, top: 8, bottom: 12 });
  });

  it("should keep the value column and the board's 4 points right of the plot inside the canvas's right padding", () => {
    expect(plotPadding.right).toBe(VALUE_COLUMN_WIDTH + 4);
  });

  it("should draw the highest value at the top padding and the lowest at the bottom padding", () => {
    const axis = { min: 80, max: 100 };

    expect(plotOffsetOf(100, axis)).toBe(8);
    expect(plotOffsetOf(80, axis)).toBe(PLOT_BOX_HEIGHT - 12);
    expect(plotOffsetOf(90, axis)).toBe(78);
  });

  it("should draw the grid of an empty range at the top, the middle and the bottom of the plot", () => {
    expect(emptyGridOffsets).toEqual([8, 78, 148]);
  });
});
