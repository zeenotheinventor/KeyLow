import { captureMessage } from "@sentry/react-native";
import { act, cleanup, screen, userEvent, waitFor, within } from "@testing-library/react-native";
import { BackHandler } from "react-native";

import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import {
  passwordResetBackend,
  renderWithPasswordReset,
  resetPasswordResetBackend,
} from "./support/passwordResetBackend";
import { resetSupabaseMock } from "./support/supabaseMock";
import { installVirtualClock } from "./support/virtualClock";
import ForgotPasswordRoute from "../app/(auth)/forgot-password";
import SignedInForgotPasswordRoute from "../app/(tabs)/more/forgot-password";
import { setForgotPasswordEmail, takeForgotPasswordEmail } from "../lib/forgotPasswordEmail";
import { readRecoveryRequestedAt } from "../lib/recoveryRequest";

const mockStorageItems = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(mockStorageItems.get(key) ?? null),
    setItem: (key: string, value: string) => {
      mockStorageItems.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      mockStorageItems.delete(key);
      return Promise.resolve();
    },
  },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

const address = "sam.taylor@example.com";
const sentSentence = `If ${address} has a Ki-Lo account, a link to set a new password is on its way. Open it on this phone. It works once, for one hour.`;
const noConnection = "Ki-Lo could not reach the server. Check your connection and try again.";

async function openForgotPassword(handedOver = "") {
  setForgotPasswordEmail(handedOver);
  await renderWithPasswordReset(<ForgotPasswordRoute />);
}

async function sendLinkTo(typed: string) {
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText("Email"));
  if (typed !== "") {
    await user.type(screen.getByLabelText("Email"), typed);
  }
  await user.press(screen.getByRole("button", { name: "Send link" }));
}

describe("forgot password screen", () => {
  beforeEach(() => {
    installVirtualClock();
    mockStorageItems.clear();
    resetRouterMock();
    resetSupabaseMock();
    resetPasswordResetBackend();
    jest.mocked(captureMessage).mockClear();
  });

  afterEach(async () => {
    takeForgotPasswordEmail();
    // Unmounting clears the Send again countdown, and it must happen on the fake clock that started it.
    await cleanup();
    jest.useRealTimers();
  });

  describe("the form", () => {
    it("should say what it is for", async () => {
      await openForgotPassword();

      expect(screen.getByRole("heading", { name: "Reset your password" })).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Enter the email you use for Ki-Lo. Ki-Lo will send a link to set a new password.",
        ),
      ).toBeOnTheScreen();
    });

    it("should start with the email Sign in handed over", async () => {
      await openForgotPassword(address);

      expect(screen.getByLabelText("Email")).toHaveDisplayValue(address);
    });

    it("should start empty when nothing was handed over", async () => {
      await openForgotPassword();

      expect(screen.getByLabelText("Email")).toHaveDisplayValue("");
    });

    it("should go back to Sign in from the back button", async () => {
      await openForgotPassword();

      await userEvent.setup().press(screen.getByRole("button", { name: "Back to sign in" }));

      expect(routerMock.dismissTo).toHaveBeenCalledWith("/(auth)/sign-in");
    });

    it("should offer Sign in in the footer for someone who remembered it", async () => {
      await openForgotPassword();

      expect(screen.getByText("Remembered it?")).toBeOnTheScreen();
      expect(screen.getByRole("link", { name: "Sign in" })).toBeOnTheScreen();
    });

    it("should return to Sign in from the footer link and not push a second one", async () => {
      await openForgotPassword();

      await userEvent.setup().press(screen.getByRole("link", { name: "Sign in" }));

      expect(routerMock.dismissTo).toHaveBeenCalledWith("/(auth)/sign-in");
      expect(routerMock.push).not.toHaveBeenCalled();
      expect(routerMock.navigate).not.toHaveBeenCalled();
    });
  });

  describe("Android hardware back", () => {
    // The latest listener, as the system asks the latest first.
    async function pressHardwareBack(
      addListener: jest.SpiedFunction<typeof BackHandler.addEventListener>,
    ) {
      const listener = addListener.mock.calls.at(-1)?.[1];
      if (typeof listener !== "function") {
        throw new Error("No Back listener is registered");
      }
      let handled: unknown;
      await act(() => {
        handled = listener({ type: "hardwareBackPress", timeStamp: 0 });
      });
      return handled;
    }

    it("should return to Sign in from the form and say it handled the press", async () => {
      const addListener = jest.spyOn(BackHandler, "addEventListener");
      await openForgotPassword();

      expect(await pressHardwareBack(addListener)).toBe(true);
      expect(routerMock.dismissTo).toHaveBeenCalledWith("/(auth)/sign-in");
    });

    it("should return to Sign in from the sent message too", async () => {
      const addListener = jest.spyOn(BackHandler, "addEventListener");
      await openForgotPassword(address);
      await userEvent.setup().press(screen.getByRole("button", { name: "Send link" }));
      await screen.findByRole("status");

      expect(await pressHardwareBack(addListener)).toBe(true);
      expect(routerMock.dismissTo).toHaveBeenCalledWith("/(auth)/sign-in");
    });

    it("should stop listening when the screen goes away", async () => {
      const remove = jest.fn();
      jest.spyOn(BackHandler, "addEventListener").mockReturnValue({ remove });
      await openForgotPassword();

      await screen.unmount();

      expect(remove).toHaveBeenCalled();
    });
  });

  describe("an email that is not an email", () => {
    it("should show the field's own error as an alert and send nothing", async () => {
      await openForgotPassword();

      await sendLinkTo("sam.taylor@");

      expect(
        await screen.findByRole("alert", { name: "Enter a valid email address" }),
      ).toBeOnTheScreen();
      expect(passwordResetBackend.requests).toHaveLength(0);
    });

    it("should ask for an address when the field is empty, and send nothing", async () => {
      await openForgotPassword();

      await sendLinkTo("");

      expect(
        await screen.findByRole("alert", { name: "Enter your email address" }),
      ).toBeOnTheScreen();
      expect(passwordResetBackend.requests).toHaveLength(0);
    });
  });

  describe("while the link is being sent", () => {
    it("should name the busy button Sending link and keep the field", async () => {
      passwordResetBackend.answer = { kind: "held" };
      await openForgotPassword(address);

      await userEvent.setup().press(screen.getByRole("button", { name: "Send link" }));

      expect(await screen.findByRole("button", { name: "Sending link" })).toBeOnTheScreen();
      expect(screen.getByLabelText("Email")).toHaveDisplayValue(address);
    });

    it("should ask Supabase for the trimmed address and the app's callback", async () => {
      passwordResetBackend.answer = { kind: "held" };
      await openForgotPassword();

      await sendLinkTo(`  ${address}  `);

      await waitFor(() => {
        expect(passwordResetBackend.requests).toHaveLength(1);
      });
      expect(passwordResetBackend.requests[0]).toMatchObject({
        redirectTo: "keylow://auth/callback",
        body: { email: address },
      });
    });
  });

  describe("when the link was sent", () => {
    it("should say Check your email with the sentence that names the typed address, as a status", async () => {
      await openForgotPassword(address);

      await userEvent.setup().press(screen.getByRole("button", { name: "Send link" }));

      expect(
        await screen.findByRole("status", { name: `Check your email ${sentSentence}` }),
      ).toBeOnTheScreen();
    });

    it("should keep its buttons outside the announced status", async () => {
      await openForgotPassword(address);

      await userEvent.setup().press(screen.getByRole("button", { name: "Send link" }));

      const status = await screen.findByRole("status");
      expect(within(status).queryByRole("button")).toBeNull();
    });

    it("should note on the phone that a reset was requested", async () => {
      await openForgotPassword(address);

      await userEvent.setup().press(screen.getByRole("button", { name: "Send link" }));
      await screen.findByRole("status");

      expect(await readRecoveryRequestedAt()).not.toBeNull();
    });

    it("should write no address into the marker", async () => {
      await openForgotPassword(address);

      await userEvent.setup().press(screen.getByRole("button", { name: "Send link" }));
      await screen.findByRole("status");

      expect([...mockStorageItems.values()].join()).not.toContain(address);
    });

    it("should go back to Sign in from Back to sign in", async () => {
      await openForgotPassword(address);
      const user = userEvent.setup();
      await user.press(screen.getByRole("button", { name: "Send link" }));

      await user.press(await screen.findByRole("button", { name: "Back to sign in" }));

      expect(routerMock.dismissTo).toHaveBeenCalledWith("/(auth)/sign-in");
    });

    it("should hint at the spam folder", async () => {
      await openForgotPassword(address);

      await userEvent.setup().press(screen.getByRole("button", { name: "Send link" }));

      expect(
        await screen.findByText("No email? Check your spam folder, or send it again."),
      ).toBeOnTheScreen();
    });
  });

  describe("when the screen goes away while the request is on its way", () => {
    it("should still note the request on the phone once it is answered", async () => {
      passwordResetBackend.answer = { kind: "held" };
      await openForgotPassword(address);
      await userEvent.setup().press(screen.getByRole("button", { name: "Send link" }));
      await waitFor(() => {
        expect(passwordResetBackend.requests).toHaveLength(1);
      });

      await screen.unmount();
      passwordResetBackend.release();
      await act(() => jest.advanceTimersByTimeAsync(100));

      expect(await readRecoveryRequestedAt()).not.toBeNull();
    });
  });

  describe("when the server says the address is not valid", () => {
    it("should show the server's verdict as the field's error and note no request", async () => {
      passwordResetBackend.answer = { kind: "refused", status: 422, code: "email_address_invalid" };
      await openForgotPassword(address);

      await userEvent.setup().press(screen.getByRole("button", { name: "Send link" }));

      expect(
        await screen.findByRole("alert", { name: "Enter a valid email address" }),
      ).toBeOnTheScreen();
      expect(await readRecoveryRequestedAt()).toBeNull();
    });
  });

  describe("when the request failed", () => {
    it("should show the sentence as an alert, keep the field and write no marker", async () => {
      passwordResetBackend.answer = { kind: "unreachable" };
      await openForgotPassword(address);

      await userEvent.setup().press(screen.getByRole("button", { name: "Send link" }));

      expect(await screen.findByRole("alert", { name: noConnection })).toBeOnTheScreen();
      expect(screen.getByLabelText("Email")).toHaveDisplayValue(address);
      expect(screen.getByRole("button", { name: "Send link" })).toBeOnTheScreen();
      expect(await readRecoveryRequestedAt()).toBeNull();
    });

    it("should say the rate limit sentence when there have been too many requests", async () => {
      passwordResetBackend.answer = {
        kind: "refused",
        status: 429,
        code: "over_request_rate_limit",
      };
      await openForgotPassword(address);

      await userEvent.setup().press(screen.getByRole("button", { name: "Send link" }));

      expect(
        await screen.findByRole("alert", {
          name: "Too many attempts. Wait a few minutes, then try again.",
        }),
      ).toBeOnTheScreen();
    });
  });

  describe("an address with an account and one without", () => {
    async function screenAfter(answer: typeof passwordResetBackend.answer) {
      resetPasswordResetBackend();
      passwordResetBackend.answer = answer;
      jest.mocked(captureMessage).mockClear();
      const view = await renderWithPasswordReset(<ForgotPasswordRoute />);
      await userEvent.setup().press(screen.getByRole("button", { name: "Send link" }));
      await screen.findByRole("status");
      const tree = JSON.stringify(view.toJSON());
      await view.unmount();

      return tree;
    }

    it("should look the same with and without an unexpected code, and report only the code", async () => {
      setForgotPasswordEmail(address);
      const plain = await screenAfter({ kind: "sent" });
      expect(captureMessage).not.toHaveBeenCalled();

      setForgotPasswordEmail(address);
      const withUnexpectedCode = await screenAfter({
        kind: "refused",
        status: 422,
        code: "x_unexpected",
      });

      expect(withUnexpectedCode).toBe(plain);
      expect(captureMessage).toHaveBeenCalledTimes(1);
      expect(captureMessage).toHaveBeenCalledWith(
        "Password reset request answered with an unexpected code",
        expect.objectContaining({ tags: { code: "x_unexpected" } }),
      );
      expect(JSON.stringify(jest.mocked(captureMessage).mock.calls)).not.toContain(address);
    });
  });

  describe("Send again", () => {
    async function openSentScreen() {
      await openForgotPassword(address);
      await userEvent.setup().press(screen.getByRole("button", { name: "Send link" }));
      await screen.findByRole("status");
    }

    it("should be disabled and say how long is left, right after sending", async () => {
      await openSentScreen();

      expect(screen.getByRole("button", { name: "Send again in 60 s" })).toBeDisabled();
    });

    it("should count down a second at a time", async () => {
      await openSentScreen();

      await act(() => jest.advanceTimersByTimeAsync(15_000));

      expect(screen.getByRole("button", { name: "Send again in 45 s" })).toBeDisabled();
    });

    it("should unlock when the minute is up", async () => {
      await openSentScreen();

      await act(() => jest.advanceTimersByTimeAsync(60_000));

      expect(screen.getByRole("button", { name: "Send again" })).toBeEnabled();
    });

    it("should send again to the same address, and start the countdown again", async () => {
      await openSentScreen();
      await act(() => jest.advanceTimersByTimeAsync(60_000));

      await userEvent.setup().press(screen.getByRole("button", { name: "Send again" }));

      await waitFor(() => {
        expect(passwordResetBackend.requests).toHaveLength(2);
      });
      expect(passwordResetBackend.requests[1]?.body).toMatchObject({ email: address });
      expect(await screen.findByRole("button", { name: "Send again in 60 s" })).toBeDisabled();
    });

    it("should note the second request on the phone as well", async () => {
      await openSentScreen();
      await act(() => jest.advanceTimersByTimeAsync(60_000));
      mockStorageItems.clear();

      await userEvent.setup().press(screen.getByRole("button", { name: "Send again" }));
      await screen.findByRole("button", { name: "Send again in 60 s" });

      expect(await readRecoveryRequestedAt()).not.toBeNull();
    });

    it("should go back to the form with the email kept and the error when the resend failed", async () => {
      await openSentScreen();
      await act(() => jest.advanceTimersByTimeAsync(60_000));
      passwordResetBackend.answer = { kind: "unreachable" };

      await userEvent.setup().press(screen.getByRole("button", { name: "Send again" }));

      expect(await screen.findByRole("alert", { name: noConnection })).toBeOnTheScreen();
      expect(screen.getByLabelText("Email")).toHaveDisplayValue(address);
      expect(screen.getByRole("button", { name: "Send link" })).toBeOnTheScreen();
    });

    it("should stop counting when the screen goes away", async () => {
      const startTimer = jest.spyOn(globalThis, "setInterval");
      const stopTimer = jest.spyOn(globalThis, "clearInterval");
      await openSentScreen();
      const countdownTimer: unknown = startTimer.mock.results.at(-1)?.value;

      await screen.unmount();

      expect(stopTimer).toHaveBeenCalledWith(countdownTimer);
    });

    it("should return to the form with the field error when the resend is refused as invalid", async () => {
      await openSentScreen();
      await act(() => jest.advanceTimersByTimeAsync(60_000));
      passwordResetBackend.answer = { kind: "refused", status: 422, code: "email_address_invalid" };

      await userEvent.setup().press(screen.getByRole("button", { name: "Send again" }));

      expect(
        await screen.findByRole("alert", { name: "Enter a valid email address" }),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText("Email")).toHaveDisplayValue(address);
      expect(screen.getByRole("button", { name: "Send link" })).toBeOnTheScreen();
    });
  });

  describe("reached signed in, from Forgot password? in the Delete account confirm", () => {
    async function openSignedIn(handedOver = "") {
      setForgotPasswordEmail(handedOver);
      await renderWithPasswordReset(<SignedInForgotPasswordRoute />);
    }

    it("should be the same screen, with the handed over email filled in", async () => {
      await openSignedIn(address);

      expect(screen.getByRole("heading", { name: "Reset your password" })).toBeOnTheScreen();
      expect(screen.getByLabelText("Email")).toHaveDisplayValue(address);
    });

    it("should name the header chevron Back, and draw no Sign in line", async () => {
      await openSignedIn();

      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Back to sign in" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeOnTheScreen();
      expect(screen.queryByText("Remembered it?")).not.toBeOnTheScreen();
    });

    it("should go back to the screen under it from the chevron and the hardware button", async () => {
      const addListener = jest.spyOn(BackHandler, "addEventListener");
      await openSignedIn();

      await userEvent.setup().press(screen.getByRole("button", { name: "Back" }));
      const listener = addListener.mock.calls.at(-1)?.[1];
      let wasHandled: boolean | null | undefined;
      await act(() => {
        wasHandled = listener?.({ type: "hardwareBackPress", timeStamp: 0 });
      });

      expect(routerMock.back).toHaveBeenCalledTimes(2);
      expect(wasHandled).toBe(true);
      expect(routerMock.dismissTo).not.toHaveBeenCalled();
    });

    it("should go to More when there is nothing before it", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      await openSignedIn();

      await userEvent.setup().press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/more");
      expect(routerMock.dismissTo).not.toHaveBeenCalled();
    });

    it("should offer Back to Delete account in the sent message, and go back with it", async () => {
      const user = userEvent.setup();
      await openSignedIn(address);
      await user.press(screen.getByRole("button", { name: "Send link" }));
      await screen.findByRole("status");

      expect(screen.queryByRole("button", { name: "Back to sign in" })).not.toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back to Delete account" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(routerMock.dismissTo).not.toHaveBeenCalled();
    });
  });
});
