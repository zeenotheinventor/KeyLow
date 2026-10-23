import { FoodsPartialWriteError, KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";

import { foodFixture, savedFoodId } from "./support/apiClientMock";
import NewFoodRoute from "../../app/foods/new";
import { beginIngredientScan, takeIngredientScan } from "../../lib/ingredientScan";
import { resetIngredientScanForTests } from "../../lib/ingredientScan/testing";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { fakeSession } from "../support/supabaseMock";

import type { CreatedFood } from "@keylow/api-client";
import type { Food } from "@keylow/core/schemas";

// The New food form opened from the scan screen in the recipe editor's ingredient mode. Only the repository
// layer is replaced: the mutations, the validation and the invalidation a save triggers are the real ones.
const mockCreateFood = jest.fn<Promise<CreatedFood>, [unknown, string, unknown]>();
const mockUpdateFood = jest.fn<Promise<Food>, [unknown, string, unknown]>();

jest.mock("../../../../packages/api-client/src/repos/foods", () => ({
  ...jest.requireActual<object>("../../../../packages/api-client/src/repos/foods"),
  createFood: (client: unknown, ownerId: string, input: unknown) =>
    mockCreateFood(client, ownerId, input),
  updateFood: (client: unknown, id: string, input: unknown) => mockUpdateFood(client, id, input),
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
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

const scannedCode = "5012345678900";

const unusedClient = createClient("http://localhost:54321", "unused-key");

async function renderForm(params: Record<string, string>) {
  routerMock.searchParams = params;
  const user = userEvent.setup();
  await render(
    <KeyLowProvider client={unusedClient} queryClient={new QueryClient()}>
      <ThemeProvider fixedPreference="dark">
        <NewFoodRoute />
      </ThemeProvider>
    </KeyLowProvider>,
  );
  return user;
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "Oat bar");
  await user.type(screen.getByLabelText("Energy (kcal)"), "420");
  await user.type(screen.getByLabelText("Protein (g)"), "8.5");
  await user.type(screen.getByLabelText("Fat (g)"), "14");
  await user.type(screen.getByLabelText("Carbohydrate (g)"), "62");
}

describe("new food form opened from a scan in the recipe editor", () => {
  beforeEach(() => {
    resetRouterMock();
    resetIngredientScanForTests();
    mockCreateFood.mockReset();
    mockCreateFood.mockResolvedValue({ food: foodFixture, portions: [] });
    mockUpdateFood.mockReset();
    mockUpdateFood.mockResolvedValue(foodFixture);
    // The mutation reads the signed-in user before it writes.
    jest
      .spyOn(unusedClient.auth, "getUser")
      .mockResolvedValue({ data: { user: fakeSession.user }, error: null });
  });

  it("should fill in the scanned barcode and lock it", async () => {
    const requestId = beginIngredientScan();

    await renderForm({ barcode: scannedCode, ingredient: requestId });

    expect(screen.getByLabelText("Barcode")).toHaveDisplayValue(scannedCode);
    expect(screen.getByLabelText("Barcode")).toHaveProp("editable", false);
    expect(screen.getByText("Filled in from the barcode you scanned")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /Create food/ })).toBeOnTheScreen();
  });

  describe("saving the food", () => {
    it("should hand the created food back to the request and close the whole sheet", async () => {
      const requestId = beginIngredientScan();
      const user = await renderForm({ barcode: scannedCode, ingredient: requestId });
      await fillRequiredFields(user);

      await user.press(screen.getByRole("button", { name: /Create food/ }));

      await waitFor(() => {
        expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
      });
      expect(mockCreateFood).toHaveBeenCalledTimes(1);
      expect(takeIngredientScan(requestId)).toBe(savedFoodId);
    });

    it("should never open the food or its portion picker", async () => {
      const requestId = beginIngredientScan();
      const user = await renderForm({ barcode: scannedCode, ingredient: requestId });
      await fillRequiredFields(user);

      await user.press(screen.getByRole("button", { name: /Create food/ }));

      await waitFor(() => {
        expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
      });
      expect(routerMock.replace).not.toHaveBeenCalled();
      expect(routerMock.push).not.toHaveBeenCalled();
    });

    it("should neither save again nor close another screen when Create is pressed again while the sheet slides away", async () => {
      const requestId = beginIngredientScan();
      const user = await renderForm({ barcode: scannedCode, ingredient: requestId });
      await fillRequiredFields(user);
      await user.press(screen.getByRole("button", { name: /Create food/ }));
      await waitFor(() => {
        expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
      });
      // The form stays mounted while the sheet slides away, and Create comes back once the save has settled.
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Create food/ })).toBeEnabled();
      });

      await user.press(screen.getByRole("button", { name: /Create food/ }));

      expect(mockCreateFood).toHaveBeenCalledTimes(1);
      expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
    });

    it("should still close the sheet, handing nothing back, when the request is not the pending one", async () => {
      const staleRequestId = beginIngredientScan();
      const pendingRequestId = beginIngredientScan();
      const user = await renderForm({ barcode: scannedCode, ingredient: staleRequestId });
      await fillRequiredFields(user);

      await user.press(screen.getByRole("button", { name: /Create food/ }));

      await waitFor(() => {
        expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
      });
      expect(takeIngredientScan(staleRequestId)).toBeUndefined();
      expect(takeIngredientScan(pendingRequestId)).toBeUndefined();
      expect(routerMock.replace).not.toHaveBeenCalled();
    });
  });

  describe("a save that wrote the food but not its portions", () => {
    async function savePartially(requestId: string) {
      mockCreateFood.mockRejectedValue(
        new FoodsPartialWriteError(savedFoodId, "portions failed", new Error("insert failed")),
      );
      const user = await renderForm({ barcode: scannedCode, ingredient: requestId });
      await fillRequiredFields(user);
      await user.press(screen.getByRole("button", { name: /Create food/ }));
      await screen.findByRole("alert", {
        name: "Portions not saved Your food was saved but its portions were not. Save again to add them.",
      });
      return user;
    }

    it("should hand nothing back and stay on the form", async () => {
      const requestId = beginIngredientScan();

      await savePartially(requestId);

      expect(takeIngredientScan(requestId)).toBeUndefined();
      expect(routerMock.parentGoBack).not.toHaveBeenCalled();
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should hand the food back and close the sheet when the second save succeeds", async () => {
      const requestId = beginIngredientScan();
      const user = await savePartially(requestId);

      await user.press(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
      });
      expect(mockCreateFood).toHaveBeenCalledTimes(1);
      expect(mockUpdateFood).toHaveBeenCalledTimes(1);
      expect(takeIngredientScan(requestId)).toBe(savedFoodId);
      expect(routerMock.replace).not.toHaveBeenCalled();
    });
  });

  describe("leaving the form without saving", () => {
    it("should go back one screen on Back and hand nothing back", async () => {
      const requestId = beginIngredientScan();
      const user = await renderForm({ barcode: scannedCode, ingredient: requestId });

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(takeIngredientScan(requestId)).toBeUndefined();
      expect(mockCreateFood).not.toHaveBeenCalled();
    });

    it("should close the whole sheet on Close and hand nothing back", async () => {
      const requestId = beginIngredientScan();
      const user = await renderForm({ barcode: scannedCode, ingredient: requestId });
      await fillRequiredFields(user);

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
      expect(takeIngredientScan(requestId)).toBeUndefined();
      expect(mockCreateFood).not.toHaveBeenCalled();
    });
  });

  describe("without the ingredient parameter, which is the diary", () => {
    it("should open the portion picker for the new food, as before", async () => {
      const requestId = beginIngredientScan();
      const user = await renderForm({ barcode: scannedCode, day: "2026-10-14", time: "12:00" });
      await fillRequiredFields(user);

      await user.press(screen.getByRole("button", { name: /Create food/ }));

      expect(await screen.findByRole("button", { name: /Create food/ })).toBeOnTheScreen();
      expect(routerMock.replace).toHaveBeenCalledWith(
        `/foods/${savedFoodId}/log?day=2026-10-14&time=12%3A00&barcode=${scannedCode}`,
      );
      expect(routerMock.parentGoBack).not.toHaveBeenCalled();
      expect(takeIngredientScan(requestId)).toBeUndefined();
    });
  });
});
