import { render, screen, within } from "@testing-library/react-native";

import { HeatLegendStrip } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

describe("HeatLegendStrip", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  it("should be one image named for the heat legend", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <HeatLegendStrip />
      </ThemeProvider>,
    );

    expect(screen.getByRole("img", { name: "Heat legend" })).toBeOnTheScreen();
  });

  it("should read Peak at the top and Rested at the bottom", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <HeatLegendStrip />
      </ThemeProvider>,
    );

    const legend = screen.getByRole("img", { name: "Heat legend" });

    expectTextsInOrder(within(legend).getAllByText(/./, { includeHiddenElements: true }), [
      "Peak",
      "Rested",
    ]);
  });
});
