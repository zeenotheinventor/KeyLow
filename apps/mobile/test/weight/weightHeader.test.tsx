import { themes } from "@keylow/tokens";
import { render, screen, userEvent } from "@testing-library/react-native";

import { WeightHeader } from "../../components/WeightScreen/WeightHeader";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { expectAccessibleNamesInOrder } from "../support/namesInOrder";
import { registerAppStyles } from "../support/nativeWindStyles";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

describe("the Weight screen's header", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/WeightScreen"]);
  });

  beforeEach(() => {
    resetRouterMock();
    registerAppStyles(kitStyles);
  });

  it("should leave 8 points to the right of the add control, as the board does", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <WeightHeader onBack={() => undefined} />
      </ThemeProvider>,
    );

    const add = await screen.findByRole("button", { name: "Add weigh-in" });
    // The control sits in a press scale view, inside the view that carries the layout classes.
    expect(add.parent?.parent).toHaveStyle({ marginRight: 8 });
  });

  describe("the info control", () => {
    async function renderHeader() {
      await render(
        <ThemeProvider fixedPreference="dark">
          <WeightHeader onBack={() => undefined} />
        </ThemeProvider>,
      );
    }

    it("should sit between the title and the add control, as the board draws it", async () => {
      await renderHeader();

      expectAccessibleNamesInOrder(await screen.findAllByRole("button"), [
        "Back to More",
        "How the trend works",
        "Add weigh-in",
      ]);
    });

    it("should open the trend explainer", async () => {
      const user = userEvent.setup();
      await renderHeader();

      await user.press(await screen.findByRole("button", { name: "How the trend works" }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/weight/explainer");
    });

    it("should be a 44 point square target", async () => {
      await renderHeader();

      const info = await screen.findByRole("button", { name: "How the trend works" });
      expect(info).toHaveStyle({ width: 44, height: 44 });
    });

    it("should draw a 22 point info glyph in the secondary text colour, as the board does", async () => {
      await renderHeader();

      await screen.findByRole("button", { name: "How the trend works" });
      const glyphs = screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
      // Back, info and add each draw one glyph, in the order of the row.
      expect(glyphs[1]).toHaveProp("width", 22);
      expect(glyphs[1]).toHaveProp("stroke", themes.dark["text-secondary"]);
    });
  });
});
