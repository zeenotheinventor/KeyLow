import { quickLogSnapshot, readyModel, readySource } from "../test/viewModels";
import { backgroundColours, colourOfText, taps, textsOf, treeOf } from "../test/widgetTree";
import { widgetThemeFor } from "../theme";
import { WeighInWidget } from "./WeighInWidget";

describe.each(["dark", "light"] as const)("the Weigh in widget in %s", (scheme) => {
  const theme = widgetThemeFor(scheme);

  it("should show the last weight, its unit, when it was logged and the Log today button", () => {
    const viewModel = readyModel("weigh_in", readySource(quickLogSnapshot()));
    const tree = treeOf(<WeighInWidget viewModel={viewModel} theme={theme} />);

    expect(textsOf(tree)).toEqual([
      viewModel.eyebrow,
      "78.4",
      "kg",
      "Logged yesterday",
      "Log today",
    ]);
    expect(colourOfText(tree, "kg")).toBe(theme.palette.textMuted);
    expect(backgroundColours(tree)).toContain(theme.palette.accent);
  });

  it("should open the weight entry from the card and from the button", () => {
    const viewModel = readyModel("weigh_in", readySource(quickLogSnapshot()));
    const tree = treeOf(<WeighInWidget viewModel={viewModel} theme={theme} />);

    expect(taps(tree).map((tap) => tap.uri)).toEqual([
      "keylow://more/weight/entry",
      "keylow://more/weight/entry",
    ]);
  });

  it("should say there is no weigh-in yet without a unit or a caption", () => {
    const viewModel = readyModel("weigh_in");
    const tree = treeOf(<WeighInWidget viewModel={viewModel} theme={theme} />);

    expect(viewModel.unit).toBeNull();
    expect(textsOf(tree)).toEqual([viewModel.eyebrow, viewModel.value, "Log today"]);
  });
});
