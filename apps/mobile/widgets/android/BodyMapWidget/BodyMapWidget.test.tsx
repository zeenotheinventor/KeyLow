import { populatedSnapshot, readyModel, readySource } from "../test/viewModels";
import { svgsOf, taps, textsOf, treeOf } from "../test/widgetTree";
import { widgetThemeFor } from "../theme";
import { BodyMapWidget } from "./BodyMapWidget";

describe.each(["dark", "light"] as const)("the Body map widget in %s", (scheme) => {
  const theme = widgetThemeFor(scheme);
  const viewModel = readyModel("body_map");
  const tree = treeOf(<BodyMapWidget viewModel={viewModel} theme={theme} />);

  it("should draw the front and the back of the figure, a worked muscle in its heat colour", () => {
    const [front, back] = svgsOf(tree);

    expect(svgsOf(tree)).toHaveLength(2);
    expect(viewModel.figure.tones.chest_upper).not.toBe("heat-0");
    expect(front).toContain(`fill="${theme.palette[viewModel.figure.tones.chest_upper]}"`);
    expect(back).toContain(`fill="${theme.palette.silhouette}"`);
  });

  it("should list the warmest muscles and label the ends of the legend", () => {
    expect(textsOf(tree)).toEqual([
      viewModel.eyebrow,
      ...viewModel.rows.flatMap((row) => [row.name, row.stepName]),
      viewModel.legend.startLabel,
      viewModel.legend.endLabel,
    ]);
  });

  it("should open the body map", () => {
    expect(taps(tree)).toEqual([{ label: viewModel.accessibleName, uri: "keylow://body-map" }]);
  });

  it("should give the summary line in place of the rows on the volume scale", () => {
    const snapshot = populatedSnapshot();
    const volume = readyModel(
      "body_map",
      readySource({ ...snapshot, bodyMap: { ...snapshot.bodyMap, scale: "volume" } }),
    );
    const volumeTexts = textsOf(treeOf(<BodyMapWidget viewModel={volume} theme={theme} />));

    expect(volume.summaryLine).not.toBeNull();
    expect(volumeTexts).toContain(volume.summaryLine);
    expect(volumeTexts).toContain(volume.legend.startLabel);
  });
});
