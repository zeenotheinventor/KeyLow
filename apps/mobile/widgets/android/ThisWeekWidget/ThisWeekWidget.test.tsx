import { populatedSnapshot, readyModel, readySource } from "../test/viewModels";
import { colourOfText, taps, textsOf, treeOf } from "../test/widgetTree";
import { widgetThemeFor } from "../theme";
import { ThisWeekWidget } from "./ThisWeekWidget";

describe.each(["dark", "light"] as const)("the This week widget in %s", (scheme) => {
  const theme = widgetThemeFor(scheme);
  const viewModel = readyModel("this_week");
  const tree = treeOf(<ThisWeekWidget viewModel={viewModel} theme={theme} />);

  it("should draw the eyebrow, the days complete, the average and its caption", () => {
    expect(viewModel.average).not.toBeNull();
    expect(textsOf(tree)).toEqual([
      viewModel.eyebrow,
      viewModel.progress,
      viewModel.average?.value,
      viewModel.average?.caption,
      ...viewModel.dots.map((dot) => dot.letter),
    ]);
  });

  it("should write today's letter in the main text colour and the others subtle", () => {
    const todayLetter = viewModel.dots.find((dot) => dot.isToday)?.letter ?? "";

    expect(colourOfText(tree, todayLetter)).toBe(theme.palette.text);
    expect(colourOfText(tree, viewModel.dots[0]?.letter ?? "")).toBe(theme.palette.textSubtle);
  });

  it("should open the week screen", () => {
    expect(taps(tree)).toEqual([{ label: viewModel.accessibleName, uri: "keylow://week" }]);
  });

  it("should say what stands in for the average when there is none", () => {
    const empty = readyModel(
      "this_week",
      readySource({
        ...populatedSnapshot(),
        week: populatedSnapshot().week.map((day) => ({ ...day, totals: null })),
      }),
    );
    const emptyTree = treeOf(<ThisWeekWidget viewModel={empty} theme={theme} />);

    expect(empty.average).toBeNull();
    expect(textsOf(emptyTree)).toContain(empty.note);
  });
});
