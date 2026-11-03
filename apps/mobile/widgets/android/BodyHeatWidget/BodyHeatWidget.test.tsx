import { populatedSnapshot, readyModel, readySource } from "../test/viewModels";
import { colourOfText, taps, textsOf, treeOf } from "../test/widgetTree";
import { widgetThemeFor } from "../theme";
import { BodyHeatWidget } from "./BodyHeatWidget";

describe.each(["dark", "light"] as const)("the Body heat widget in %s", (scheme) => {
  const theme = widgetThemeFor(scheme);
  const viewModel = readyModel("body_heat");
  const tree = treeOf(<BodyHeatWidget viewModel={viewModel} theme={theme} />);

  it("should list the warmest muscles with their step and then today's plan", () => {
    expect(viewModel.rows.length).toBeGreaterThan(0);
    expect(textsOf(tree)).toEqual([
      viewModel.eyebrow,
      ...viewModel.rows.flatMap((row) => [row.name, row.stepName]),
      viewModel.todayLine,
    ]);
    expect(colourOfText(tree, viewModel.rows[0]?.stepName ?? "")).toBe(theme.palette.textMuted);
  });

  it("should open the body map", () => {
    expect(taps(tree)).toEqual([{ label: viewModel.accessibleName, uri: "keylow://body-map" }]);
  });

  it("should say nothing is warm when no muscle has heat", () => {
    const cold = readyModel(
      "body_heat",
      readySource({
        ...populatedSnapshot(),
        bodyMap: { ...populatedSnapshot().bodyMap, heatSets: [] },
      }),
    );
    const coldTree = treeOf(<BodyHeatWidget viewModel={cold} theme={theme} />);

    expect(cold.emptyLine).not.toBeNull();
    expect(textsOf(coldTree)).toContain(cold.emptyLine);
  });
});
