import { readyModel } from "../test/viewModels";
import { backgroundColours, colourOfText, svgsOf, taps, textsOf, treeOf } from "../test/widgetTree";
import { widgetThemeFor } from "../theme";
import { LogGridWidget } from "./LogGridWidget";

describe.each(["dark", "light"] as const)("the Log grid widget in %s", (scheme) => {
  const theme = widgetThemeFor(scheme);
  const viewModel = readyModel("log_grid");
  const tree = treeOf(<LogGridWidget viewModel={viewModel} theme={theme} />);

  it("should label the four shortcuts as board B does", () => {
    expect(textsOf(tree)).toEqual(["Search", "Scan", "Quick add", "Weight"]);
    expect(colourOfText(tree, "Search")).toBe(theme.palette.text);
  });

  it("should draw an icon on each tile", () => {
    expect(svgsOf(tree)).toHaveLength(4);
    expect(svgsOf(tree)[0]).toContain(`stroke="${theme.palette.text}"`);
  });

  it("should put each tile on the button fill, inside the card", () => {
    const fills = backgroundColours(tree);

    expect(fills[0]).toBe(theme.surface);
    expect(fills.filter((fill) => fill === theme.buttonBackground)).toHaveLength(4);
  });

  it("should open the search, the scanner, quick add and the weight entry, named for a screen reader", () => {
    expect(taps(tree)).toEqual([
      { label: "Search for a food", uri: "keylow://foods" },
      { label: "Scan a barcode", uri: "keylow://foods/scan" },
      { label: "Quick add calories", uri: "keylow://foods/quick-add" },
      { label: "Log weight", uri: "keylow://more/weight/entry" },
    ]);
  });
});
