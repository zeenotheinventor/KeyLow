import { KeyLowProvider } from "@keylow/api-client";
import { cleanup, render, screen } from "@testing-library/react-native";

import SetupRoute from "../../app/setup";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient } from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resetSetupBackend, setupClient } from "../support/setupBackend";

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

async function renderRoute() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={setupClient} queryClient={createDiaryQueryClient()}>
        <ToastProvider>
          <SetupRoute />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

describe("the setup route", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SetupScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetSetupBackend();
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should switch the iOS edge swipe off, so it cannot leave the wizard from a middle step", async () => {
    await renderRoute();

    expect(routerMock.screenOptions).toContainEqual({ gestureEnabled: false });
  });

  it("should open the first run, with no Close, for mode=first-run", async () => {
    routerMock.searchParams = { mode: "first-run" };

    await renderRoute();

    expect(screen.getByRole("heading", { name: "What is your sex?" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeOnTheScreen();
  });

  it("should open the recalculation, with Close, for mode=recalculate", async () => {
    routerMock.searchParams = { mode: "recalculate" };

    await renderRoute();

    expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
  });

  it("should open the recalculation when there is no mode", async () => {
    await renderRoute();

    expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
  });

  it("should open the recalculation for a mode it does not know", async () => {
    routerMock.searchParams = { mode: "onboarding" };

    await renderRoute();

    expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
  });
});
