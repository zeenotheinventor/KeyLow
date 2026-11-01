import { render, screen, within } from "@testing-library/react-native";

import { VolumeLegendStrip } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

describe("VolumeLegendStrip", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  it("should be one image named for the volume legend", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <VolumeLegendStrip />
      </ThemeProvider>,
    );

    expect(screen.getByRole("img", { name: "Volume legend" })).toBeOnTheScreen();
  });

  it("should read High at the top and Not trained at the bottom", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <VolumeLegendStrip />
      </ThemeProvider>,
    );

    const legend = screen.getByRole("img", { name: "Volume legend" });

    expectTextsInOrder(within(legend).getAllByText(/./, { includeHiddenElements: true }), [
      "High",
      "Not trained",
    ]);
  });
});
