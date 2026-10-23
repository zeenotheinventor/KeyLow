import { render, screen } from "@testing-library/react-native";

import { WeightHeader } from "../../components/WeightScreen/WeightHeader";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
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
});
