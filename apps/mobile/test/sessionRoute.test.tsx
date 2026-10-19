import { KeyLowProvider } from "@keylow/api-client";
import { TRAIN_DISCARD_FAILED } from "@keylow/core/copy";
import { act, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { useState } from "react";

import SessionRoute from "../app/session";
import { Button, ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { finishClient, finishWrites, resetFinishWrites } from "./support/finishBackend";
import { legsRoutine, goldenLegsOpen } from "./support/sessionGoldenLegs";
import { resetTrainBackend, trainBackend } from "./support/trainBackend";
import { resetTrainWrites, trainWrites } from "./support/trainWritesBackend";

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
      <KeyLowProvider client={finishClient} queryClient={createDiaryQueryClient()}>
        <ToastProvider>
          <SessionRoute />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

// The route with a test control that closes it, as the Android back key or a swipe would, while the toast
// provider above it stays.
function RouteThatCloses() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      {isOpen ? <SessionRoute /> : null}
      <Button
        onPress={() => {
          setIsOpen(false);
        }}
      >
        Close route
      </Button>
    </>
  );
}

describe("the session route", () => {
  beforeEach(() => {
    resetRouterMock();
    resetTrainBackend();
    resetTrainWrites();
    resetFinishWrites();
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

  describe("discarding the session", () => {
    async function discardTheSession() {
      const user = userEvent.setup();
      await renderRoute();
      await user.press(await screen.findByRole("button", { name: "More" }));
      await user.press(await screen.findByRole("button", { name: "Discard session" }));
      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: "Discard session" })).toHaveLength(1);
      });
      await user.press(screen.getByRole("button", { name: "Discard session" }));
    }

    it("should go back to the tab it came from once the session is gone", async () => {
      await discardTheSession();

      await waitFor(() => {
        expect(routerMock.back).toHaveBeenCalledTimes(1);
      });
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should go to the Train tab when a cold link has nothing to go back to", async () => {
      routerMock.canGoBack.mockReturnValue(false);

      await discardTheSession();

      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/train");
      });
      expect(routerMock.back).not.toHaveBeenCalled();
    });

    it("should show the error toast inside the screen's own provider when the discard fails", async () => {
      trainWrites.failDeletes = true;

      await discardTheSession();

      expect(await screen.findByRole("status", { name: TRAIN_DISCARD_FAILED })).toBeOnTheScreen();
      expect(routerMock.back).not.toHaveBeenCalled();
    });
  });

  it("should leave the way hiding does once a finished session is saved", async () => {
    const user = userEvent.setup();
    await renderRoute();

    await user.press(await screen.findByRole("button", { name: "Finish" }));
    await user.press(await screen.findByRole("button", { name: "Save session" }));

    await waitFor(() => {
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("should show one toast and leave nothing a second time when the save lands after the route closed", async () => {
    let release: () => void = () => undefined;
    finishWrites.holdPatches = new Promise<void>((resolve) => {
      release = resolve;
    });
    const user = userEvent.setup();
    await render(
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={finishClient} queryClient={createDiaryQueryClient()}>
          <ToastProvider>
            <RouteThatCloses />
          </ToastProvider>
        </KeyLowProvider>
      </ThemeProvider>,
    );
    await user.press(await screen.findByRole("button", { name: "Finish" }));
    await user.press(await screen.findByRole("button", { name: "Save session" }));
    await screen.findByRole("button", { name: /^Saving session/ });
    await user.press(screen.getByRole("button", { name: "Close route" }));

    await act(() => {
      release();
    });

    expect(await screen.findByRole("status", { name: "Session saved" })).toBeOnTheScreen();
    expect(screen.getAllByRole("status", { name: "Session saved" })).toHaveLength(1);
    expect(routerMock.back).not.toHaveBeenCalled();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("should show the Session saved toast, from the provider above the route, as the screen closes", async () => {
    const user = userEvent.setup();
    await renderRoute();

    await user.press(await screen.findByRole("button", { name: "Finish" }));
    await user.press(await screen.findByRole("button", { name: "Save session" }));

    expect(await screen.findByRole("status", { name: "Session saved" })).toBeOnTheScreen();
    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });
});
