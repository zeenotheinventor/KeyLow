import { KeyLowProvider } from "@keylow/api-client";
import { act, render, screen, userEvent, waitFor } from "@testing-library/react-native";

import { WeightScreen } from "../../components/WeightScreen";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import {
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
  weightClient,
  weighInRow,
} from "../support/weightBackend";

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

async function renderWeightScreen() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={weightClient} queryClient={createWeightQueryClient()}>
        <WeightScreen />
      </KeyLowProvider>
    </ThemeProvider>,
  );
  // The read starts after the first render, and the screen's own update for it is settled before a test looks.
  await waitFor(() => {
    expect(weightBackend.weighInRequestCount).toBeGreaterThan(0);
  });
}

const backControl = () => screen.getByRole("button", { name: "Back to More" });

describe("the Weight screen", () => {
  beforeEach(() => {
    resetRouterMock();
    resetWeightBackend();
  });

  // The time zone is read beside the weigh-ins, and a test that has what it came for may end before it lands.
  afterEach(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  describe("its header", () => {
    // The header is the same in every state, so the read is held and nothing changes under the test.
    beforeEach(() => {
      weightBackend.weighInReadsHang = true;
    });

    it("should be headed Weight", async () => {
      await renderWeightScreen();

      expect(screen.getByRole("heading", { name: "Weight" })).toBeOnTheScreen();
    });

    it("should go back when Back to More is pressed", async () => {
      const user = userEvent.setup();
      await renderWeightScreen();

      await user.press(backControl());

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should go to More when a link opened it cold, with nothing to go back to", async () => {
      const user = userEvent.setup();
      routerMock.canGoBack.mockReturnValue(false);
      await renderWeightScreen();

      await user.press(backControl());

      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/more");
    });
  });

  describe("while the weigh-ins load", () => {
    beforeEach(() => {
      weightBackend.weighInReadsHang = true;
    });

    it("should show a status named Loading your weigh-ins", async () => {
      await renderWeightScreen();

      expect(screen.getByRole("status", { name: "Loading your weigh-ins" })).toBeOnTheScreen();
    });

    it("should keep the back control, and draw no other", async () => {
      await renderWeightScreen();

      expect(screen.getAllByRole("button")).toEqual([backControl()]);
    });
  });

  describe("when the weigh-ins cannot be read", () => {
    beforeEach(() => {
      weightBackend.weighInReadsFail = true;
    });

    it("should say so, with the sentence under it, and offer Try again", async () => {
      await renderWeightScreen();

      expect(
        await screen.findByRole("alert", { name: /Couldn't load your weigh-ins/ }),
      ).toBeOnTheScreen();
      expect(
        screen.getByText("Check your connection and try again. Nothing you logged has been lost."),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
    });

    it("should keep the back control", async () => {
      await renderWeightScreen();
      await screen.findByRole("button", { name: "Try again" });

      expect(backControl()).toBeOnTheScreen();
    });

    it("should show none of the database's own words", async () => {
      await renderWeightScreen();
      await screen.findByRole("button", { name: "Try again" });

      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
    });

    it("should read the weigh-ins once more when Try again is pressed, and show what comes back", async () => {
      const user = userEvent.setup();
      await renderWeightScreen();
      await user.press(await screen.findByRole("button", { name: "Try again" }));
      expect(weightBackend.weighInRequestCount).toBe(2);

      weightBackend.weighInReadsFail = false;
      await user.press(await screen.findByRole("button", { name: "Try again" }));

      expect(await screen.findByRole("heading", { name: "No weigh-ins yet" })).toBeOnTheScreen();
      expect(weightBackend.weighInRequestCount).toBe(3);
    });
  });

  describe("with no weigh-ins", () => {
    it("should say there are none, with the sentence under it", async () => {
      await renderWeightScreen();

      expect(await screen.findByRole("heading", { name: "No weigh-ins yet" })).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Add one now, or bring in readings from your smart scale through Health Connect. Your trend starts after the first weigh-in.",
        ),
      ).toBeOnTheScreen();
    });

    it("should have no button but Back, because what they would open is not built yet", async () => {
      await renderWeightScreen();
      await screen.findByRole("heading", { name: "No weigh-ins yet" });

      expect(screen.getAllByRole("button")).toEqual([backControl()]);
    });
  });

  describe("with weigh-ins", () => {
    it("should leave the loading, error and empty states, and keep the back control", async () => {
      weightBackend.weighIns = [
        weighInRow({ localDate: "2026-10-17", utcTime: "06:42", weightKg: 81.6 }),
      ];
      await renderWeightScreen();

      await waitFor(() => {
        expect(
          screen.queryByRole("status", { name: "Loading your weigh-ins" }),
        ).not.toBeOnTheScreen();
      });

      expect(screen.queryByRole("heading", { name: "No weigh-ins yet" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(backControl()).toBeOnTheScreen();
    });
  });
});
