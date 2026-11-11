import { KeyLowProvider } from "@keylow/api-client";
import { act, fireEvent, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { useState } from "react";

import FeatureRequestRoute from "../app/(tabs)/more/feature-request";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import {
  featureRequestBackend,
  featureRequestClient,
  resetFeatureRequestBackend,
} from "./support/featureRequestBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

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

// With `closesOnBack`, going back takes the screen away and leaves the providers, as the stack does, so a toast outlives the screen.
function ScreenInAStack({ closesOnBack }: { closesOnBack: boolean }) {
  const [isOpen, setIsOpen] = useState(true);
  if (closesOnBack) {
    routerMock.back.mockImplementation(() => {
      setIsOpen(false);
    });
  }
  return isOpen ? <FeatureRequestRoute /> : null;
}

async function renderScreen({ closesOnBack = false } = {}) {
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={featureRequestClient} queryClient={createDiaryQueryClient()}>
        <ToastProvider>
          <ScreenInAStack closesOnBack={closesOnBack} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

const field = () => screen.getByLabelText("Your feature request");
const sendButton = () => screen.getByRole("button", { name: "Send" });

describe("the Request a feature screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/FeatureRequestScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetFeatureRequestBackend();
  });

  it("should be headed Request a feature and say where the request goes", async () => {
    await renderScreen();

    expect(screen.getByRole("heading", { name: "Request a feature" })).toBeOnTheScreen();
    expect(
      screen.getByText("Your request goes to the Ki-Lo team, and every one is read."),
    ).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("What should Ki-Lo do next?")).toBeOnTheScreen();
  });

  it("should go back with the Back button", async () => {
    routerMock.back.mockReset();
    const user = await renderScreen();

    await user.press(screen.getByRole("button", { name: "Back to More" }));

    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });

  it("should replace with More when there is nothing to go back to", async () => {
    routerMock.canGoBack.mockReturnValue(false);
    const user = await renderScreen();

    await user.press(screen.getByRole("button", { name: "Back to More" }));

    expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/more");
  });

  describe("the count and the Send button", () => {
    it("should show the count against 1,000 and keep Send off while nothing is typed", async () => {
      await renderScreen();

      expect(screen.getByText("0 / 1,000")).toBeOnTheScreen();
      expect(sendButton()).toBeDisabled();
    });

    it("should keep Send off under 3 characters once the text is trimmed", async () => {
      const user = await renderScreen();

      await user.type(field(), "  ab  ");

      expect(screen.getByText("2 / 1,000")).toBeOnTheScreen();
      expect(sendButton()).toBeDisabled();
    });

    it("should turn Send on at 3 trimmed characters", async () => {
      const user = await renderScreen();

      await user.type(field(), "abc");

      expect(sendButton()).toBeEnabled();
    });
  });

  describe("a request that is too long", () => {
    it("should say so, turn the count to a warning and keep Send off", async () => {
      await renderScreen();

      await fireEvent.changeText(field(), "a".repeat(1001));

      expect(screen.getByText("1,001 / 1,000")).toBeOnTheScreen();
      expect(
        screen.getByText("That is over 1,000 characters. Shorten it to send."),
      ).toBeOnTheScreen();
      expect(sendButton()).toBeDisabled();
    });

    it("should send again once it is shortened to 1,000", async () => {
      await renderScreen();

      await fireEvent.changeText(field(), "a".repeat(1001));
      await fireEvent.changeText(field(), "a".repeat(1000));

      expect(
        screen.queryByText("That is over 1,000 characters. Shorten it to send."),
      ).not.toBeOnTheScreen();
      expect(sendButton()).toBeEnabled();
    });
  });

  describe("sending", () => {
    it("should save the trimmed text as a more_menu request with no context", async () => {
      const user = await renderScreen();

      await user.type(field(), "  Water tracking please  ");
      await user.press(sendButton());

      await waitFor(() => {
        expect(featureRequestBackend.inserts).toEqual([
          { source: "more_menu", request: "Water tracking please", context: null },
        ]);
      });
    });

    it("should thank the user, clear the field and go back to More once it is saved", async () => {
      const user = await renderScreen();

      await user.type(field(), "Water tracking please");
      await user.press(sendButton());

      expect(await screen.findByText("Thanks, your request has been sent")).toBeOnTheScreen();
      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(field()).toHaveDisplayValue("");
    });

    it("should hold Send busy and send only once while the request is on its way", async () => {
      featureRequestBackend.isHolding = true;
      const user = await renderScreen();

      await user.type(field(), "Water tracking please");
      await user.press(sendButton());
      await waitFor(() => {
        expect(screen.getByRole("button", { busy: true })).toBeOnTheScreen();
      });
      await user.press(screen.getByRole("button", { busy: true }));

      expect(featureRequestBackend.inserts).toHaveLength(1);

      await act(() => {
        featureRequestBackend.held.forEach((release) => {
          release();
        });
      });
      await screen.findByText("Thanks, your request has been sent");
    });
  });

  describe("going back while a send is on its way", () => {
    it("should still thank the user once the send is saved", async () => {
      featureRequestBackend.isHolding = true;
      const user = await renderScreen({ closesOnBack: true });

      await user.type(field(), "Water tracking please");
      await user.press(sendButton());
      await waitFor(() => {
        expect(screen.getByRole("button", { busy: true })).toBeOnTheScreen();
      });
      await user.press(screen.getByRole("button", { name: "Back to More" }));
      await act(() => {
        featureRequestBackend.held.forEach((release) => {
          release();
        });
      });

      expect(await screen.findByText("Thanks, your request has been sent")).toBeOnTheScreen();
    });
  });

  describe("when it fails", () => {
    it("should keep the text and show the error banner, never the database message", async () => {
      featureRequestBackend.failWithCode = "XX000";
      featureRequestBackend.failWithMessage = "raw database text";
      const user = await renderScreen();

      await user.type(field(), "Water tracking please");
      await user.press(sendButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(/^Your request was not sent/);
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
      expect(field()).toHaveDisplayValue("Water tracking please");
      expect(routerMock.back).not.toHaveBeenCalled();
      expect(sendButton()).toBeEnabled();
    });

    it("should say the daily limit was reached and to try again tomorrow", async () => {
      featureRequestBackend.failWithCode = "54000";
      featureRequestBackend.failWithMessage = "feature_requests_daily_cap";
      const user = await renderScreen();

      await user.type(field(), "Water tracking please");
      await user.press(sendButton());

      const banner = await screen.findByRole("alert");
      expect(banner).toHaveTextContent(/^Daily limit reached/);
      expect(banner).toHaveTextContent(/Try again tomorrow\./);
      expect(field()).toHaveDisplayValue("Water tracking please");
    });

    it("should take the banner away when the user sends again", async () => {
      featureRequestBackend.failWithCode = "XX000";
      const user = await renderScreen();

      await user.type(field(), "Water tracking please");
      await user.press(sendButton());
      await screen.findByRole("alert");
      featureRequestBackend.failWithCode = undefined;
      await user.press(sendButton());

      await screen.findByText("Thanks, your request has been sent");
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });
  });
});
