import {
  GUTTER_WIDTH,
  PLOT_INSET_X,
  PLOT_INSET_Y,
  gutterClassName,
  plotInsetXClassName,
  plotInsetYClassName,
  plotPadding,
} from "../../components/ui/LineChart/layout";
import { compileAppStyles } from "../support/nativeWindStyles";

// The first declaration of a class, such as 48 for `width: 48px`.
async function pixelsOf(className: string): Promise<number> {
  const css = await compileAppStyles(className);
  // A dot in a class name is escaped in the style sheet.
  const rule = css.slice(css.indexOf(`.${className.replace(".", "\\.")} {`));
  const declaration = /: (\d+(?:\.\d+)?)px/.exec(rule);
  return Number(declaration?.[1]);
}

describe("the line chart's room", () => {
  it("should give the gutter class the width the chart counts on", async () => {
    expect(await pixelsOf(gutterClassName)).toBe(GUTTER_WIDTH);
  });

  it("should give the sideways inset class the padding the plot is given", async () => {
    expect(await pixelsOf(plotInsetXClassName)).toBe(PLOT_INSET_X);
  });

  it("should give the vertical inset class the padding the plot is given", async () => {
    expect(await pixelsOf(plotInsetYClassName)).toBe(PLOT_INSET_Y);
  });

  it("should pad the plot by the same insets on every side", () => {
    expect(plotPadding).toEqual({
      left: PLOT_INSET_X,
      right: PLOT_INSET_X,
      top: PLOT_INSET_Y,
      bottom: PLOT_INSET_Y,
    });
  });
});
