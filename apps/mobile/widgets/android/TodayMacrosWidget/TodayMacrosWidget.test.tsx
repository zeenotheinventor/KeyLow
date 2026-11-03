import { readyModel } from "../test/viewModels";
import { colourOfText, svgsOf, taps, textsOf, treeOf } from "../test/widgetTree";
import { widgetThemeFor } from "../theme";
import { TodayMacrosWidget } from "./TodayMacrosWidget";

describe.each(["dark", "light"] as const)("the Today with macros widget in %s", (scheme) => {
  const theme = widgetThemeFor(scheme);
  const viewModel = readyModel("today_macros");
  const tree = treeOf(<TodayMacrosWidget viewModel={viewModel} theme={theme} />);

  it("should name the day and list each macro with what was eaten of its target", () => {
    expect(textsOf(tree)).toEqual([
      viewModel.eyebrow,
      ...viewModel.macros.flatMap((macro) => [macro.label, macro.value]),
    ]);
    expect(colourOfText(tree, viewModel.macros[0]?.value ?? "")).toBe(theme.palette.textMuted);
    expect(colourOfText(tree, viewModel.macros[0]?.label ?? "")).toBe(theme.palette.text);
  });

  it("should draw the regular ring beside them", () => {
    expect(svgsOf(tree)).toHaveLength(1);
    expect(svgsOf(tree)[0]).toContain(`>${viewModel.ring.value}</text>`);
  });

  it("should open today's diary", () => {
    expect(taps(tree)).toEqual([{ label: viewModel.accessibleName, uri: "keylow://diary" }]);
  });
});
