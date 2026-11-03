import { ENTRY_ID } from "../../../test/support/widgetFixtures";
import {
  RECENT_FOODS,
  pendingUndoOf,
  quickLogSnapshot,
  readyModel,
  readySource,
} from "../test/viewModels";
import {
  asLaunched,
  backgroundColours,
  colourOfText,
  customTaps,
  svgsOf,
  taps,
  textsOf,
  treeOf,
} from "../test/widgetTree";
import { widgetThemeFor } from "../theme";
import { LogAgainWidget } from "./LogAgainWidget";

describe.each(["dark", "light"] as const)("the Log again widget in %s", (scheme) => {
  const theme = widgetThemeFor(scheme);
  const source = readySource(quickLogSnapshot());

  it("should list the recent foods with their energy, and the eyebrow above", () => {
    const viewModel = readyModel("log_again", source);
    const tree = treeOf(<LogAgainWidget viewModel={viewModel} theme={theme} />);

    expect(textsOf(tree)).toEqual([
      viewModel.eyebrow,
      "Overnight oats",
      "410 kcal",
      "Chicken wrap",
      "520 kcal",
      "Protein shake",
      "180 kcal",
    ]);
    expect(colourOfText(tree, "410 kcal")).toBe(theme.palette.textMuted);
    expect(backgroundColours(tree).filter((fill) => fill === theme.buttonBackground)).toHaveLength(
      3,
    );
    expect(svgsOf(tree)[0]).toContain(`stroke="${theme.palette.accent}"`);
  });

  it("should log a row again with only the id of its entry in the click data", () => {
    const viewModel = readyModel("log_again", source);
    const tree = treeOf(<LogAgainWidget viewModel={viewModel} theme={theme} />);

    expect(customTaps(tree)).toEqual(
      RECENT_FOODS.map((food) => ({
        action: "LOG_AGAIN",
        data: { entryId: food.id },
        label: `Log ${food.name} again, ${food.kcal} kcal`,
      })),
    );
  });

  it("should open the foods screen from the card", () => {
    const viewModel = readyModel("log_again", source);
    const tree = treeOf(<LogAgainWidget viewModel={viewModel} theme={theme} />);

    expect(taps(tree).map((tap) => tap.uri)).toEqual(["keylow://foods"]);
  });

  it("should turn the tapped row into Logged with Undo while the window is open", () => {
    const viewModel = readyModel("log_again", source, {
      pendingUndo: pendingUndoOf("log_again", ENTRY_ID),
    });
    const tree = treeOf(<LogAgainWidget viewModel={viewModel} theme={theme} />);

    expect(textsOf(tree)).toEqual([
      viewModel.eyebrow,
      "Logged Overnight oats",
      "Undo",
      "Chicken wrap",
      "520 kcal",
      "Protein shake",
      "180 kcal",
    ]);
    expect(colourOfText(tree, "Logged Overnight oats")).toBe(theme.palette.success);
    expect(colourOfText(tree, "Undo")).toBe(theme.palette.accent);
    expect(backgroundColours(tree)).toContain(asLaunched(theme.successMuted));
    expect(customTaps(tree).map((tap) => tap.action)).toEqual(["UNDO", "LOG_AGAIN", "LOG_AGAIN"]);
    expect(customTaps(tree)[0]?.data).toEqual({});
  });
});
