import { render, screen, userEvent } from "@testing-library/react-native";

import { resetApiClientMock } from "./support/apiClientMock";
import { compileFoodSearchStyles } from "./support/foodSearchStyles";
import { resetSearchApiClientMock } from "./support/searchApiClientMock";
import { FoodSearch } from "../../components/FoodSearch";
import { ThemeProvider } from "../../lib/theme";
import { registerAppStyles } from "../support/nativeWindStyles";

// The food search in its ingredient mode, which finds a food for a recipe: it ends in the same Scan barcode
// control as the log search.

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "@keylow/api-client",
  () =>
    jest.requireActual<{ mockSearchApiClient: unknown }>("./support/searchApiClientMock")
      .mockSearchApiClient,
);
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

describe("the ingredient search", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileFoodSearchStyles();
  });

  beforeEach(() => {
    registerAppStyles(styles);
    resetApiClientMock();
    resetSearchApiClientMock();
  });

  it("should end the search field in a Scan barcode button", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <FoodSearch
          ingredient={{ onOpenRecent: jest.fn() }}
          onClose={jest.fn()}
          onOpenFood={jest.fn()}
          onScanBarcode={jest.fn()}
        />
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "Scan barcode" })).toBeOnTheScreen();
  });

  it("should call onScanBarcode when the button is pressed", async () => {
    const onScanBarcode = jest.fn();
    const user = userEvent.setup();
    await render(
      <ThemeProvider fixedPreference="dark">
        <FoodSearch
          ingredient={{ onOpenRecent: jest.fn() }}
          onClose={jest.fn()}
          onOpenFood={jest.fn()}
          onScanBarcode={onScanBarcode}
        />
      </ThemeProvider>,
    );

    await user.press(screen.getByRole("button", { name: "Scan barcode" }));

    expect(onScanBarcode).toHaveBeenCalledTimes(1);
  });

  it("should still offer no create control", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <FoodSearch
          ingredient={{ onOpenRecent: jest.fn() }}
          onClose={jest.fn()}
          onOpenFood={jest.fn()}
          onScanBarcode={jest.fn()}
        />
      </ThemeProvider>,
    );

    expect(screen.queryByRole("button", { name: "Create a food" })).not.toBeOnTheScreen();
  });
});
