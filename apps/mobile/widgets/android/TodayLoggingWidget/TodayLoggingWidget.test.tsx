import { readyModel } from "../test/viewModels";
import { backgroundColours, colourOfText, svgsOf, taps, textsOf, treeOf } from "../test/widgetTree";
import { widgetThemeFor } from "../theme";
import { TodayLoggingWidget } from "./TodayLoggingWidget";

describe.each(["dark", "light"] as const)("the Today plus logging widget in %s", (scheme) => {
  const theme = widgetThemeFor(scheme);
  const viewModel = readyModel("today_logging");
  const tree = treeOf(<TodayLoggingWidget viewModel={viewModel} theme={theme} />);

  it("should draw the compact ring and the four actions", () => {
    expect(svgsOf(tree)[0]).toContain(`>${viewModel.ring.value}</text>`);
    expect(textsOf(tree)).toEqual(["Log food", "Scan", "Quick add", "Recipe"]);
  });

  it("should draw Log food on the accent and the others on the button fill", () => {
    expect(backgroundColours(tree).filter((fill) => fill === theme.palette.accent)).toHaveLength(1);
    expect(colourOfText(tree, "Log food")).toBe(theme.palette.onAccent);
    expect(colourOfText(tree, "Scan")).toBe(theme.palette.text);
  });

  it("should open the diary from the card and each shortcut from its tile", () => {
    expect(taps(tree).map((tap) => tap.uri)).toEqual([
      "keylow://diary",
      "keylow://foods",
      "keylow://foods/scan",
      "keylow://foods/quick-add",
      "keylow://more/recipes",
    ]);
  });
});
