import { KeyLowProvider } from "@keylow/api-client";
import { render, screen, userEvent } from "@testing-library/react-native";

import SessionRoute from "../app/session";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { legsRoutine, goldenLegsOpen } from "./support/sessionGoldenLegs";
import { resetTrainBackend, trainBackend, trainClient } from "./support/trainBackend";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

async function renderRoute() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={trainClient} queryClient={createDiaryQueryClient()}>
        <SessionRoute />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

describe("the session route", () => {
  beforeEach(() => {
    resetRouterMock();
    resetTrainBackend();
    trainBackend.routine = legsRoutine;
    trainBackend.activeSession = goldenLegsOpen();
  });

  it("should go back to the tab it came from when the session is hidden", async () => {
    const user = userEvent.setup();
    await renderRoute();

    await screen.findByRole("heading", { name: "Legs" });
    await user.press(screen.getByRole("button", { name: "Hide session, it keeps running" }));

    expect(routerMock.back).toHaveBeenCalledTimes(1);
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("should go to the Train tab when a cold link has nothing to go back to", async () => {
    routerMock.canGoBack.mockReturnValue(false);
    const user = userEvent.setup();
    await renderRoute();

    await screen.findByRole("heading", { name: "Legs" });
    await user.press(screen.getByRole("button", { name: "Hide session, it keeps running" }));

    expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/train");
    expect(routerMock.back).not.toHaveBeenCalled();
  });
});
