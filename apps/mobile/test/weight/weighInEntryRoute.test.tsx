import { KeyLowProvider } from "@keylow/api-client";
import { cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import WeighInEntryRoute from "../../app/(tabs)/more/weight/entry";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { importedWeighIn, manualWeighIn } from "../support/weighInSheetHarness";
import {
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
  weightClient,
} from "../support/weightBackend";

import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);

setUpTests();

const frame = { x: 0, y: 0, width: 390, height: 844 };
const insets = { top: 47, right: 0, bottom: 34, left: 0 };

let queryClient: QueryClient;

async function renderRoute(id?: string) {
  routerMock.searchParams = id === undefined ? {} : { id };
  await render(
    <SafeAreaProvider initialMetrics={{ frame, insets }}>
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={weightClient} queryClient={queryClient}>
          <WeighInEntryRoute />
        </KeyLowProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe("the weigh-in entry route", () => {
  beforeEach(() => {
    resetRouterMock();
    resetWeightBackend();
    weightBackend.weighIns = [{ ...manualWeighIn }, { ...importedWeighIn }];
    queryClient = createWeightQueryClient();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    queryClient.clear();
  });

  it("should add a weigh-in when it has no id", async () => {
    await renderRoute();

    expect(await screen.findByRole("heading", { name: "Add weigh-in" })).toBeOnTheScreen();
  });

  it("should open the weigh-in the id names, editable when it is manual", async () => {
    await renderRoute(manualWeighIn.id);

    expect(await screen.findByRole("heading", { name: "Weigh-in" })).toBeOnTheScreen();
    expect(screen.getByLabelText("Weight (kg)")).toHaveDisplayValue("81.4");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    });
  });

  it("should open an imported weigh-in with the notice and no Save", async () => {
    await renderRoute(importedWeighIn.id);

    expect(await screen.findByRole("heading", { name: "Weigh-in" })).toBeOnTheScreen();
    expect(
      screen.getByText("Imported from Health Connect. Edit it in Health Connect."),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeOnTheScreen();
  });

  it("should draw nothing while the list loads, and not replace itself", async () => {
    weightBackend.weighInReadsHang = true;
    await renderRoute(manualWeighIn.id);

    expect(screen.queryByRole("heading", { name: "Weigh-in" })).not.toBeOnTheScreen();
    expect(routerMock.redirect).not.toHaveBeenCalled();
  });

  it("should replace itself with the Weight screen for an id the list does not hold", async () => {
    await renderRoute("00000000-0000-4000-8000-0000000000ff");

    await waitFor(() => {
      expect(routerMock.redirect).toHaveBeenCalledWith("/more/weight");
    });
    expect(screen.queryByRole("dialog")).not.toBeOnTheScreen();
  });

  it("should go back once, and not replace itself, when the weigh-in it opened is deleted", async () => {
    const user = userEvent.setup();
    await renderRoute(manualWeighIn.id);

    await user.press(await screen.findByRole("button", { name: "Delete weigh-in" }));

    await waitFor(() => {
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });
    expect(routerMock.redirect).not.toHaveBeenCalled();
  });

  it("should replace itself with the Weight screen, not go back, when nothing is behind it", async () => {
    const user = userEvent.setup();
    routerMock.canGoBack.mockReturnValue(false);
    await renderRoute();

    await user.press(await screen.findByRole("button", { name: "Cancel" }));

    expect(routerMock.back).not.toHaveBeenCalled();
    expect(routerMock.replace).toHaveBeenCalledWith("/more/weight");
  });

  it("should close the same way from a weigh-in it opened", async () => {
    const user = userEvent.setup();
    routerMock.canGoBack.mockReturnValue(false);
    await renderRoute(manualWeighIn.id);

    await user.press(await screen.findByRole("button", { name: "Delete weigh-in" }));

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/more/weight");
    });
    expect(routerMock.back).not.toHaveBeenCalled();
  });

  it("should present as a transparent modal that fades, with the stack's background cleared", async () => {
    await renderRoute();

    const options = routerMock.screenOptions.at(-1);
    expect(options).toMatchObject({ presentation: "transparentModal", animation: "fade" });
    expect(options).toHaveProperty("contentStyle", undefined);
  });

  it("should go back when Cancel is pressed", async () => {
    const user = userEvent.setup();
    await renderRoute();

    await user.press(await screen.findByRole("button", { name: "Cancel" }));

    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });
});
