import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { act, render, screen, userEvent, waitFor } from "@testing-library/react-native";

import { foodFixture } from "./support/apiClientMock";
import { invalidateFoodQueries } from "../../../../packages/api-client/src/invalidateFoodQueries";
import ScanRoute from "../../app/foods/scan";
import { ThemeProvider } from "../../lib/theme";
import { resetCameraMock, scanBarcode } from "../support/expoCameraMock";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";

import type { Food, OffProductResponse } from "@keylow/core/schemas";

// Only the repository layer is replaced. The barcode hook, its cache and the invalidation a save
// triggers are the real ones, which is what a form saving over the scan screen runs.
const mockGetFoodByBarcode = jest.fn<Promise<Food | null>, [unknown, string]>();
const mockFetchOffProduct = jest.fn<Promise<OffProductResponse | null>, [unknown, string]>();

jest.mock("../../../../packages/api-client/src/repos/foods", () => ({
  ...jest.requireActual<object>("../../../../packages/api-client/src/repos/foods"),
  getFoodByBarcode: (client: unknown, code: string) => mockGetFoodByBarcode(client, code),
}));
jest.mock("../../../../packages/api-client/src/repos/off", () => ({
  ...jest.requireActual<object>("../../../../packages/api-client/src/repos/off"),
  fetchOffProduct: (client: unknown, code: string) => mockFetchOffProduct(client, code),
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "expo-camera",
  () => jest.requireActual<{ mockExpoCamera: unknown }>("../support/expoCameraMock").mockExpoCamera,
);

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
// The real provider renders nothing until the device reports its insets.
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

const cola = "5449000000996";

// The repository layer is stubbed, so this client is never called.
const unusedClient = createClient("http://localhost:54321", "unused-key");

function screenUnderTest(queryClient: QueryClient) {
  return (
    <KeyLowProvider client={unusedClient} queryClient={queryClient}>
      <ThemeProvider fixedPreference="dark">
        <ScanRoute />
      </ThemeProvider>
    </KeyLowProvider>
  );
}

describe("scan screen with a food created over it", () => {
  beforeEach(() => {
    resetRouterMock();
    resetCameraMock();
    mockGetFoodByBarcode.mockReset();
    mockFetchOffProduct.mockReset();
    mockGetFoodByBarcode.mockResolvedValue(null);
    mockFetchOffProduct.mockResolvedValue(null);
  });

  it("should neither open the food nor stay stuck when saving it refreshes the barcode lookup", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
    const user = userEvent.setup();
    const { rerender } = await render(screenUnderTest(queryClient));
    await act(() => {
      scanBarcode("ean13", cola);
    });
    await user.press(await screen.findByRole("button", { name: "Create food with this barcode" }));
    expect(routerMock.push).toHaveBeenCalledWith(`/foods/new?barcode=${cola}`);

    // The form is now on top, so this screen is out of focus, and saving the food refreshes its cache.
    routerMock.isFocused = false;
    await rerender(screenUnderTest(queryClient));
    mockGetFoodByBarcode.mockResolvedValue(foodFixture);
    await act(async () => {
      await invalidateFoodQueries(queryClient);
    });

    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    });
    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(screen.queryByText("Opening the food")).not.toBeOnTheScreen();

    // Backing out of the form lands on a fresh camera, not on the card that offered to create.
    routerMock.isFocused = true;
    await rerender(screenUnderTest(queryClient));

    expect(screen.getByLabelText("Barcode viewfinder")).toBeOnTheScreen();
    expect(
      screen.queryByRole("button", { name: "Create food with this barcode" }),
    ).not.toBeOnTheScreen();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});
