import { render, screen } from "@testing-library/react-native";

import { MacroTile } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { viewsDrawn } from "../support/viewsDrawn";

import type { MacroTileProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const carbohydrate: MacroTileProps = {
  label: "Carbohydrate",
  macro: "carbs",
  grams: 218,
  share: null,
};

async function renderTile(props: MacroTileProps) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <MacroTile {...props} />
    </ThemeProvider>,
  );
}

describe("MacroTile", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  it("should name the tile by its label and grams when it has no share", async () => {
    await renderTile(carbohydrate);

    expect(screen.getByLabelText("Carbohydrate, 218 g")).toBeOnTheScreen();
    expect(screen.getByText("218")).toBeOnTheScreen();
  });

  it("should add the share to the name and draw it when it has one", async () => {
    await renderTile({ ...carbohydrate, grams: 20.3, share: 42 });

    expect(screen.getByLabelText("Carbohydrate, 20 g, 42 % of energy")).toBeOnTheScreen();
    expect(screen.getByText("42 %")).toBeOnTheScreen();
  });

  it("should draw its colour mark 8 points square and hidden from a screen reader", async () => {
    await renderTile(carbohydrate);

    const [dot] = viewsDrawn({ width: 8, height: 8 });
    expect(dot).toHaveProp("aria-hidden", true);
  });

  it("should not let its colour mark shrink beside a long label", async () => {
    await renderTile(carbohydrate);

    const [dot] = viewsDrawn({ width: 8, height: 8 });
    expect(dot).toHaveStyle({ flexShrink: 0 });
  });
});
