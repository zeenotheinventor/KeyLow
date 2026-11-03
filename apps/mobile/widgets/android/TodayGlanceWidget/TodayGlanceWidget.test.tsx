import { readyModel } from "../test/viewModels";
import { colourOfText, svgsOf, taps, textsOf, treeOf } from "../test/widgetTree";
import { widgetThemeFor } from "../theme";
import { TodayGlanceWidget } from "./TodayGlanceWidget";

describe.each(["dark", "light"] as const)("the Today at a glance widget in %s", (scheme) => {
  const theme = widgetThemeFor(scheme);
  const viewModel = readyModel("today_glance");
  const tree = treeOf(<TodayGlanceWidget viewModel={viewModel} theme={theme} />);

  it("should hold the day's eyebrow, the macros, the week and the training line", () => {
    const texts = textsOf(tree);

    expect(texts[0]).toBe(viewModel.eyebrow);
    for (const macro of viewModel.macros) {
      expect(texts).toContain(macro.label);
      expect(texts).toContain(macro.value);
    }
    expect(texts).toContain(viewModel.week.eyebrow);
    expect(texts).toContain(viewModel.week.line);
    expect(texts).toContain(viewModel.training?.eyebrow);
    expect(texts).toContain(viewModel.training?.line);
    expect(texts).toContain(viewModel.training?.heatChip?.text);
  });

  it("should draw the ring and the chevron as SVGs, the chevron in the subtle text colour", () => {
    const [chevron, ring] = svgsOf(tree);

    expect(svgsOf(tree)).toHaveLength(2);
    expect(ring).toContain(`>${viewModel.ring.value}</text>`);
    expect(chevron).toContain(`stroke="${theme.palette.textSubtle}"`);
  });

  it("should write the week line in the main text colour", () => {
    expect(colourOfText(tree, viewModel.week.line)).toBe(theme.palette.text);
  });

  it("should open the dashboard", () => {
    expect(taps(tree)).toEqual([{ label: viewModel.accessibleName, uri: "keylow://dashboard" }]);
  });
});
