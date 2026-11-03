import { readyModel, readySource } from "../test/viewModels";
import { backgroundColours, colourOfText, svgsOf, taps, textsOf, treeOf } from "../test/widgetTree";
import { widgetThemeFor } from "../theme";
import { TodayRingWidget } from "./TodayRingWidget";

describe.each(["dark", "light"] as const)("the Today ring widget in %s", (scheme) => {
  const theme = widgetThemeFor(scheme);
  const viewModel = readyModel("today_ring");
  const tree = treeOf(<TodayRingWidget viewModel={viewModel} theme={theme} />);

  it("should draw the eyebrow in the subtle text colour and the eaten of target below the ring", () => {
    expect(textsOf(tree)).toEqual([viewModel.eyebrow, viewModel.ring.eatenOfTarget]);
    expect(colourOfText(tree, viewModel.eyebrow)).toBe(theme.palette.textSubtle);
  });

  it("should draw the ring as an SVG in the accent colour with what is left in the middle", () => {
    const [ring] = svgsOf(tree);

    expect(ring).toContain(`>${viewModel.ring.value}</text>`);
    expect(ring).toContain(`stroke="${theme.palette.accent}"`);
    expect(ring).toContain(`stroke="${theme.palette.track}"`);
  });

  it("should sit on the card surface", () => {
    expect(backgroundColours(tree)[0]).toBe(theme.surface);
  });

  it("should open today's diary from anywhere on it, named for a screen reader", () => {
    expect(taps(tree)).toEqual([{ label: viewModel.accessibleName, uri: "keylow://diary" }]);
  });

  it("should say it is offline in place of the eaten of target, with the ring dimmed", () => {
    const offline = readyModel("today_ring", readySource(), { isOffline: true });
    const offlineTree = treeOf(<TodayRingWidget viewModel={offline} theme={theme} />);

    expect(textsOf(offlineTree)).toEqual([offline.eyebrow, offline.status?.text]);
    expect(colourOfText(offlineTree, offline.status?.text ?? "")).toBe(theme.palette.warning);
    const [ring, offlineIcon] = svgsOf(offlineTree);

    expect(ring).toContain(`stroke="${theme.palette.textSubtle}"`);
    expect(offlineIcon).toContain(`stroke="${theme.palette.warning}"`);
  });
});
